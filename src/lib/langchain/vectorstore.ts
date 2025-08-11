import { QdrantVectorStore } from '@langchain/qdrant'
import { getEmbeddingVectors } from './embeddings'
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

    vectorStoreInstance = new QdrantVectorStore(customEmbeddings, {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: process.env.QDRANT_COLLECTION_NAME || 'nutralogos',
      collectionConfig: {
        vectors: {
          size: 1536, // OpenAI ada-002 embedding dimension
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
  const vectorStore = getVectorStore()

  // Use database settings if not provided
  const k = options.k ?? (await RAGSettings.getRetrievalK())
  const scoreThreshold =
    options.scoreThreshold ?? (await RAGSettings.getScoreThreshold())

  return vectorStore.asRetriever({
    k,
    scoreThreshold,
    searchType: 'similarity_score_threshold',
  })
}
