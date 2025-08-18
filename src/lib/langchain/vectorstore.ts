import { QdrantVectorStore } from '@langchain/qdrant'
import { getEmbeddingVector, getEmbeddingVectors } from './embeddings'
import { searchMultiVector } from '@/lib/qdrant'
import { SettingsService } from '@/lib/settings-service'
import { randomUUID } from 'crypto'

/**
 * Lazy-loaded Qdrant Vector Store
 * Created only when needed to avoid env issues during import
 */
let vectorStoreInstance: QdrantVectorStore | null = null

/**
 * Get or create Qdrant Vector Store instance
 */
export function getVectorStore(): QdrantVectorStore {
  if (!vectorStoreInstance) {
    if (!process.env.QDRANT_URL) {
      throw new Error('QDRANT_URL environment variable is not set')
    }
    if (!process.env.QDRANT_API_KEY) {
      throw new Error('QDRANT_API_KEY environment variable is not set')
    }

    // Create a custom embeddings object that uses our direct OpenAI implementation
    const customEmbeddings = {
      embedQuery: async (text: string) => {
        const { getEmbeddingVector } = await import('./embeddings')
        return getEmbeddingVector(text)
      },
      embedDocuments: async (texts: string[]) => {
        return getEmbeddingVectors(texts)
      },
    }

    // Determine vector dimension based on embedding model
    const embeddingModel =
      process.env.OPENAI_EMBEDDING_MODEL ||
      process.env.NEXT_PUBLIC_OPENAI_EMBEDDING_MODEL ||
      'text-embedding-3-large'
    const vectorSize = (() => {
      if (embeddingModel.includes('text-embedding-3-large')) return 3072
      if (embeddingModel.includes('text-embedding-3-small')) return 1536
      if (embeddingModel.includes('ada-002')) return 1536
      return 3072
    })()

    vectorStoreInstance = new QdrantVectorStore(customEmbeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION_NAME || 'nutralogos',
      collectionConfig: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine', // Cosine similarity for semantic search
        },
      },
    })
  }

  return vectorStoreInstance
}

/**
 * Search for similar documents using semantic similarity
 * @param query - Search query text
 * @param k - Number of documents to return
 * @param scoreThreshold - Minimum similarity score (0-1)
 * @returns Promise with documents and scores
 */
export async function searchSimilarDocuments(
  query: string,
  k?: number,
  scoreThreshold?: number
) {
  // Загружаем актуальные настройки если параметры не переданы
  const { RAGSettings } = await import('../settings-service')
  const defaultK = k ?? (await RAGSettings.getRetrievalK())
  const defaultScoreThreshold =
    scoreThreshold ?? (await RAGSettings.getScoreThreshold())
  try {
    const vectorStore = getVectorStore()
    const results = await vectorStore.similaritySearchWithScore(query, defaultK)

    const filtered = results.filter(([, score]) =>
      typeof score === 'number' ? score >= defaultScoreThreshold : true
    )

    return filtered.map(([document, score]) => ({
      document,
      score,
      content: document.pageContent,
      metadata: document.metadata,
    }))
  } catch (error: unknown) {
    console.error('❌ Error searching documents:', error)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Vector search failed: ${msg}`)
  }
}

/**
 * Add documents to the vector store
 * @param documents - Array of LangChain Document objects
 * @returns Promise<string[]> - Array of document IDs
 */
export async function addDocuments(
  documents: Array<{ pageContent: string; metadata: Record<string, unknown> }>
) {
  try {
    console.log(`🔗 [QDRANT] Starting to add ${documents.length} documents...`)
    const vectorStore = getVectorStore()

    console.log(`🔗 [QDRANT] Vector store initialized, adding documents...`)

    // Generate our own IDs since LangChain Qdrant doesn't return them
    const generatedIds = documents.map(() => randomUUID())

    // Add IDs to documents metadata
    const documentsWithIds = documents.map((doc, index) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        id: generatedIds[index],
      },
    }))

    await vectorStore.addDocuments(documentsWithIds)

    console.log(
      `✅ [QDRANT] Added ${documents.length} documents to vector store`
    )
    console.log(`🔍 [QDRANT] Generated IDs:`, generatedIds)

    return generatedIds
  } catch (error: unknown) {
    console.error('❌ [QDRANT] Error adding documents:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    if (msg) console.error('❌ [QDRANT] Error details:', msg)
    if (stack) console.error('❌ [QDRANT] Error stack:', stack)
    throw new Error(`Failed to add documents: ${msg}`)
  }
}

import { RAGSettings } from '@/lib/settings-service'

/**
 * Create retriever instance for RAG chains
 * @param options - Retrieval options
 * @returns VectorStoreRetriever instance
 */
export async function createRetriever(
  options: {
    k?: number
    scoreThreshold?: number
  } = {}
) {
  const multivectorEnabled = await SettingsService.getSettingValue<boolean>(
    'multivector_enabled',
    false
  )

  // Use database settings if not provided
  const k = options.k ?? (await RAGSettings.getRetrievalK())
  const scoreThreshold =
    options.scoreThreshold ?? (await RAGSettings.getScoreThreshold())

  if (!multivectorEnabled) {
    const vectorStore = getVectorStore()
    return vectorStore.asRetriever({
      k,
      searchType: 'similarity',
    })
  }

  // Custom retriever using multi-vector search
  return {
    async getRelevantDocuments(query: string) {
      const [contentVec, metaVec] = await Promise.all([
        getEmbeddingVector(query),
        getEmbeddingVector(query),
      ])
      const contentWeight = await SettingsService.getSettingValue<number>(
        'multivector_content_weight',
        0.8
      )
      const metaWeight = await SettingsService.getSettingValue<number>(
        'multivector_meta_weight',
        0.2
      )
      const docs = await searchMultiVector(
        contentVec,
        metaVec,
        k,
        contentWeight,
        metaWeight
      )
      // Map to LangChain Document-like objects
      const filtered = docs.map((d) => ({
        pageContent: d.content,
        metadata: d.metadata as Record<string, unknown>,
        score: (d as unknown as { score?: number }).score ?? undefined,
      }))
      // Apply threshold if present
      return filtered.filter((d) =>
        typeof d.score === 'number'
          ? (d.score as number) >= scoreThreshold
          : true
      )
    },
  }
}
