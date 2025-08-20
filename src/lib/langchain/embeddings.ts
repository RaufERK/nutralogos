import OpenAI from 'openai'
import { SettingsService } from '@/lib/settings-service'
import { throttle } from '@/lib/redis'

// Simple in-memory cache for embeddings
const embeddingCache = new Map<string, number[]>()

// Distributed throttling via Redis
const MIN_REQUEST_INTERVAL = 200

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  maxRetries: 3,
  timeout: 30000, // 30 second timeout
})

let EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'

async function syncEmbeddingModelFromSettings(): Promise<void> {
  try {
    const model = await SettingsService.getSettingValue<string>(
      'embedding_model',
      EMBEDDING_MODEL
    )
    if (model && model !== EMBEDDING_MODEL) {
      EMBEDDING_MODEL = model
    }
  } catch {}
}

/**
 * Direct OpenAI API embedding function with caching and rate limiting
 * @param text - Text to embed
 * @returns Promise<number[]> - Embedding vector
 */
export async function getEmbeddingVector(text: string): Promise<number[]> {
  try {
    await syncEmbeddingModelFromSettings()
    // Check cache first
    const cacheKey = text.substring(0, 100) // Use first 100 chars as key
    if (embeddingCache.has(cacheKey)) {
      console.log('💾 [EMBEDDINGS] Using cached embedding')
      return embeddingCache.get(cacheKey)!
    }

    await throttle('openai:embeddings:single', MIN_REQUEST_INTERVAL)

    console.log('🔗 [EMBEDDINGS] Getting embedding for text')

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    })

    const result = response.data[0].embedding

    // Cache the result
    embeddingCache.set(cacheKey, result)

    // Limit cache size to prevent memory leaks
    if (embeddingCache.size > 100) {
      const firstKey = embeddingCache.keys().next().value as string | undefined
      if (typeof firstKey === 'string') {
        embeddingCache.delete(firstKey)
      }
    }

    return result
  } catch (error: unknown) {
    console.error('❌ [EMBEDDINGS] Error getting embedding:', error)

    // Handle specific OpenAI errors
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('rate_limit')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.')
    } else if (msg.includes('quota')) {
      throw new Error('OpenAI API quota exceeded. Please check your account.')
    } else if (msg.includes('authentication')) {
      throw new Error(
        'OpenAI API authentication failed. Please check your API key.'
      )
    } else {
      throw new Error(`Embedding generation failed: ${msg}`)
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
    await syncEmbeddingModelFromSettings()
    const startTime = Date.now()
    console.log(`🔗 [EMBEDDINGS] Getting embeddings for ${texts.length} texts`)
    console.log(
      `🔗 [EMBEDDINGS] =============== STARTING EMBEDDING PROCESS ===============`
    )

    // Use batch size from settings
    let batchSize = 5
    try {
      const configured = await SettingsService.getSettingValue<number>(
        'embedding_batch_size',
        5
      )
      batchSize = Math.max(1, Math.floor(configured))
    } catch {}
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchStartTime = Date.now()
      console.log(
        `📦 [EMBEDDINGS] Processing batch ${
          Math.floor(i / batchSize) + 1
        }/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`
      )

      // Distributed throttle between batches
      if (i > 0) {
        await throttle('openai:embeddings:batch', 500)
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
  } catch (error: unknown) {
    console.error('❌ [EMBEDDINGS] Error getting embeddings:', error)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`Batch embedding generation failed: ${msg}`)
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
