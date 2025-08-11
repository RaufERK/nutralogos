import { llm, createLLM } from './llm'
import { createRetriever } from './vectorstore'
import { createDynamicPrompt, formatEnhancedContextForPrompt } from './prompts'
import { RAGSettings } from '@/lib/settings-service'

/**
 * Simple RAG chain implementation without external dependencies
 * Combines document retrieval with LLM generation
 */
export async function createSpiritualRAGChain() {
  // Получаем параметры из настроек
  const retrievalK = await RAGSettings.getRetrievalK()
  const scoreThreshold = await RAGSettings.getScoreThreshold()

  const retriever = await createRetriever({
    k: retrievalK, // Из настроек retrieval_k
    scoreThreshold: scoreThreshold, // Из настроек score_threshold
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
type RetrievedDoc = {
  pageContent?: string
  content?: string
  metadata?: Record<string, unknown>
  score?: number
}
type Retriever = {
  getRelevantDocuments: (query: string) => Promise<RetrievedDoc[]>
}

type LLM = {
  invoke: (input: unknown) => Promise<{ content: string }>
}

export class EnhancedSpiritualRAGChain {
  private retriever: Retriever | null
  private llm: LLM | null
  private prompt: {
    format: (input: { context: string; question: string }) => Promise<string>
  } | null

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
    // Всегда пересоздаём retriever чтобы получить актуальные настройки
    const retrievalK = await RAGSettings.getRetrievalK()
    const scoreThreshold = await RAGSettings.getScoreThreshold()
    this.retriever = await createRetriever({
      k: retrievalK,
      scoreThreshold: scoreThreshold,
    })

    if (!this.llm) {
      this.llm = (await createLLM()) as unknown as LLM
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
    sourceDocuments: RetrievedDoc[]
    relevanceScores: number[]
  }> {
    try {
      // Initialize components with dynamic settings
      await this.initialize()

      // Step 1: Retrieve documents
      const retrievedDocs = await this.retriever!.getRelevantDocuments(
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
      const llm = this.llm!
      const prompt = this.prompt!
      const response = await llm.invoke([
        {
          role: 'system',
          content: await prompt.format({
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
      throw new Error(
        `RAG processing failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Re-rank documents based on spiritual keywords and context
   * This implements our custom re-ranking logic from the original system
   */
  private async reRankDocuments(
    documents: Array<{
      pageContent?: string
      metadata?: Record<string, unknown>
      score?: number
    }>,
    query: string
  ): Promise<
    Array<{
      pageContent?: string
      metadata?: Record<string, unknown>
      score?: number
      content?: string
    }>
  > {
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
      const metaScore =
        doc.metadata && typeof (doc.metadata as Record<string, unknown>).score === 'number'
          ? ((doc.metadata as Record<string, unknown>).score as number)
          : 0.5
      let relevanceScore: number = metaScore

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
