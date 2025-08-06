import { llm, createLLM } from './llm'
import { createRetriever } from './vectorstore'
import {
  createSpiritualPrompt,
  createDynamicPrompt,
  formatEnhancedContextForPrompt,
} from './prompts'
import { RAGSettings } from '@/lib/settings-service'

/**
 * Simple RAG chain implementation without external dependencies
 * Combines document retrieval with LLM generation
 */
export async function createSpiritualRAGChain() {
  const retriever = createRetriever({
    k: 8, // Retrieve top 8 most relevant documents
    scoreThreshold: 0.3, // Only include documents with similarity > 30%
  })

  const prompt = await createDynamicPrompt(true)

  // Return a simple chain-like object
  return {
    async call(options: { query: string }) {
      try {
        // 1. Retrieve documents
        const documents = await retriever.getRelevantDocuments(options.query)

        // 2. Format context
        const context = documents.map((doc) => doc.pageContent).join('\n\n')

        // 3. Generate prompt
        const formattedPrompt = await prompt.format({
          context: context || 'Контекст не найден.',
          question: options.query,
        })

        // 4. Get LLM response
        const response = await llm.invoke(formattedPrompt)

        return {
          text: response.content,
          sourceDocuments: documents,
        }
      } catch (error) {
        console.error('❌ Simple RAG Chain Error:', error)
        throw error
      }
    },
  }
}

/**
 * Enhanced RAG chain with custom document processing
 * Includes re-ranking and enhanced context formatting
 */
export class EnhancedSpiritualRAGChain {
  private retriever: any
  private llm: any
  private prompt: any

  constructor() {
    // Initialize with default values, will be updated in call method
    this.retriever = null
    this.llm = null
    this.prompt = null
  }

  /**
   * Initialize components with dynamic settings
   */
  private async initialize() {
    if (!this.retriever) {
      this.retriever = await createRetriever()
    }
    if (!this.llm) {
      this.llm = await createLLM()
    }
    // Всегда пересоздаём prompt чтобы получить актуальные настройки
    const spiritualEnabled = await RAGSettings.isSpiritualPromptEnabled()
    this.prompt = await createDynamicPrompt(spiritualEnabled)
  }

  /**
   * Process a query through the enhanced RAG pipeline
   */
  async call(options: { query: string }): Promise<{
    text: string
    sourceDocuments: any[]
    relevanceScores: number[]
  }> {
    try {
      // Initialize components with dynamic settings
      await this.initialize()

      // Step 1: Retrieve documents
      const retrievedDocs = await this.retriever.getRelevantDocuments(
        options.query
      )

      if (retrievedDocs.length === 0) {
        return {
          text: 'Извините, я не смог найти релевантную информацию по вашему вопросу в базе знаний. Попробуйте переформулировать вопрос или задать более конкретный.',
          sourceDocuments: [],
          relevanceScores: [],
        }
      }

      // Step 2: Re-rank documents (our custom logic) - only if enabled
      const rerankEnabled = await RAGSettings.isRerankEnabled()
      const rerankedDocs = rerankEnabled
        ? await this.reRankDocuments(retrievedDocs, options.query)
        : retrievedDocs

      // Step 3: Format enhanced context
      const context = formatEnhancedContextForPrompt(rerankedDocs)

      // Step 4: Generate response
      const response = await this.llm.invoke([
        {
          role: 'system',
          content: await this.prompt.format({
            context,
            question: options.query,
          }),
        },
      ])

      return {
        text: response.content,
        sourceDocuments: rerankedDocs,
        relevanceScores: rerankedDocs.map((doc) => doc.score || 0),
      }
    } catch (error) {
      console.error('❌ Enhanced RAG Chain Error:', error)
      throw new Error(`RAG processing failed: ${error.message}`)
    }
  }

  /**
   * Re-rank documents based on spiritual keywords and context
   * This implements our custom re-ranking logic from the original system
   */
  private async reRankDocuments(
    documents: any[],
    query: string
  ): Promise<any[]> {
    const spiritualKeywords = [
      'бог',
      'душа',
      'дух',
      'молитва',
      'вера',
      'любовь',
      'свет',
      'истина',
      'мудрость',
      'сердце',
      'сознание',
      'энергия',
      'чакра',
      'медитация',
      'просветление',
      'карма',
      'вознесение',
      'учитель',
      'владыка',
      'христос',
    ]

    const queryWords = query.toLowerCase().split(/\s+/)

    const rankedDocs = documents.map((doc) => {
      const content = (doc.pageContent || '').toLowerCase()
      let relevanceScore = doc.metadata?.score || 0.5

      // Boost for spiritual keywords in query
      const spiritualBoost = queryWords.some((word) =>
        spiritualKeywords.includes(word)
      )
        ? 1.5
        : 1.0

      // Boost for documents containing spiritual keywords
      const docSpiritualCount = spiritualKeywords.filter((keyword) =>
        content.includes(keyword)
      ).length
      const docSpiritualBoost = 1 + docSpiritualCount * 0.1

      // Boost for exact query word matches
      const queryMatches = queryWords.filter((word) =>
        content.includes(word)
      ).length
      const queryMatchBoost = 1 + queryMatches * 0.2

      // Calculate final relevance score
      relevanceScore =
        relevanceScore * spiritualBoost * docSpiritualBoost * queryMatchBoost

      return {
        ...doc,
        score: Math.min(relevanceScore, 1.0), // Cap at 1.0
        content: doc.pageContent,
        metadata: doc.metadata,
      }
    })

    // Sort by relevance score (highest first)
    return rankedDocs.sort((a, b) => (b.score || 0) - (a.score || 0))
  }
}

/**
 * Create and return enhanced RAG chain instance
 */
export function createEnhancedRAGChain() {
  return new EnhancedSpiritualRAGChain()
}

/**
 * Simple RAG chain for basic queries
 * Uses our custom simple implementation
 */
export async function createSimpleRAGChain() {
  return await createSpiritualRAGChain()
}
