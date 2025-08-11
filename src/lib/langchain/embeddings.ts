import OpenAI from 'openai'

// Simple in-memory cache for embeddings
const embeddingCache = new Map<string, number[]>()

// Rate limiting
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 200 // 200ms between requests

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  maxRetries: 3,
  timeout: 30000, // 30 second timeout
})

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

/**
 * Direct OpenAI API embedding function with caching and rate limiting
 * @param text - Text to embed
 * @returns Promise<number[]> - Embedding vector
 */
export async function getEmbeddingVector(text: string): Promise<number[]> {
  try {
    // Check cache first
    const cacheKey = text.substring(0, 100) // Use first 100 chars as key
    if (embeddingCache.has(cacheKey)) {
      console.log('💾 [EMBEDDINGS] Using cached embedding')
      return embeddingCache.get(cacheKey)!
    }

    // Rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest
      console.log(`⏱️ [EMBEDDINGS] Rate limiting: waiting ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    console.log(
      `🔗 [EMBEDDINGS] Getting embedding for text (${text.length} chars)`
    )

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    })

    lastRequestTime = Date.now()
    const result = response.data[0].embedding

    // Cache the result
    embeddingCache.set(cacheKey, result)

    // Limit cache size to prevent memory leaks
    if (embeddingCache.size > 100) {
      const firstKey = embeddingCache.keys().next().value
      embeddingCache.delete(firstKey)
    }

    return result
  } catch (error) {
    console.error('❌ [EMBEDDINGS] Error getting embedding:', error)

    // Handle specific OpenAI errors
    if (error.message.includes('rate_limit')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.')
    } else if (error.message.includes('quota')) {
      throw new Error('OpenAI API quota exceeded. Please check your account.')
    } else if (error.message.includes('authentication')) {
      throw new Error(
        'OpenAI API authentication failed. Please check your API key.'
      )
    } else {
      throw new Error(`Embedding generation failed: ${error.message}`)
    }
  }
}

/**
 * Get embeddings for multiple texts with batching and rate limiting
 * @param texts - Array of texts to embed
 * @returns Promise<number[][]> - Array of embedding vectors
 */
export async function getEmbeddingVectors(
  texts: string[]
): Promise<number[][]> {
  try {
    const startTime = Date.now()
    console.log(`🔗 [EMBEDDINGS] Getting embeddings for ${texts.length} texts`)
    console.log(
      `🔗 [EMBEDDINGS] =============== STARTING EMBEDDING PROCESS ===============`
    )

    // Process in smaller batches to prevent overload
    const batchSize = 5 // Very small batch size for stability
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchStartTime = Date.now()
      console.log(
        `📦 [EMBEDDINGS] Processing batch ${
          Math.floor(i / batchSize) + 1
        }/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`
      )

      // Rate limiting between batches
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500)) // 500ms delay between batches
      }

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      })

      const batchResults = response.data.map((item) => item.embedding)
      results.push(...batchResults)

      const batchTime = Date.now() - batchStartTime
      console.log(`✅ [EMBEDDINGS] Batch completed in ${batchTime}ms`)

      // Force garbage collection hint
      if (global.gc) {
        global.gc()
      }
    }

    const totalTime = Date.now() - startTime
    console.log(
      `🎉 [EMBEDDINGS] =============== EMBEDDING COMPLETED ===============`
    )
    console.log(
      `✅ [EMBEDDINGS] Successfully generated ${results.length} embeddings in ${totalTime}ms`
    )
    return results
  } catch (error) {
    console.error('❌ [EMBEDDINGS] Error getting embeddings:', error)
    throw new Error(`Batch embedding generation failed: ${error.message}`)
  }
}

/**
 * Clear embedding cache (useful for testing or memory management)
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear()
  console.log('🧹 [EMBEDDINGS] Cache cleared')
}

// Export a dummy embeddings object for compatibility with existing code
export const embeddings = {
  embedQuery: getEmbeddingVector,
  embedDocuments: getEmbeddingVectors,
}
