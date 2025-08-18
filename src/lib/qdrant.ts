import { QdrantClient } from '@qdrant/js-client-rest'
import { QdrantPoint, Document, DocumentMetadata } from './types'
import { SettingsService } from './settings-service'

const QDRANT_URL = process.env.QDRANT_URL
const QDRANT_API_KEY = process.env.QDRANT_API_KEY
const QDRANT_COLLECTION_NAME =
  process.env.QDRANT_COLLECTION_NAME || 'nutralogos'

// Создаем клиент только если URL настроен
let client: QdrantClient | null = null

function getClient(): QdrantClient {
  if (!QDRANT_URL) {
    throw new Error('QDRANT_URL is not set in environment variables')
  }

  if (!client) {
    client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    })
  }

  return client
}

export async function createCollection(): Promise<void> {
  try {
    const qdrantClient = getClient()
    const embeddingModel =
      process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'
    const vectorSize = embeddingModel.includes('text-embedding-3-small')
      ? 1536
      : 3072
    const multivectorEnabled = await SettingsService.getSettingValue<boolean>(
      'multivector_enabled',
      false
    )
    if (multivectorEnabled) {
      await (
        qdrantClient as unknown as {
          createCollection: (
            name: string,
            cfg: {
              vectors:
                | { size: number; distance: 'Cosine' }
                | {
                    content: { size: number; distance: 'Cosine' }
                    meta: { size: number; distance: 'Cosine' }
                  }
            }
          ) => Promise<void>
        }
      ).createCollection(QDRANT_COLLECTION_NAME, {
        vectors: {
          content: { size: vectorSize, distance: 'Cosine' },
          meta: { size: vectorSize, distance: 'Cosine' },
        },
      })
    } else {
      await qdrantClient.createCollection(QDRANT_COLLECTION_NAME, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      })
    }
    console.log('Collection created successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('already exists')) {
      console.log('Collection already exists')
    } else {
      throw error
    }
  }
}

export async function upsertMultiVectorPoints(
  points: Array<{
    id: string
    contentVector: number[]
    metaVector: number[]
    payload: { content: string; metadata?: Record<string, unknown> }
  }>
): Promise<void> {
  const qdrantClient = getClient()

  if (!points || points.length === 0) return

  const contentLen = points[0].contentVector.length
  const metaLen = points[0].metaVector.length

  for (const p of points) {
    if (!Array.isArray(p.contentVector) || !Array.isArray(p.metaVector)) {
      throw new Error('upsertMultiVectorPoints: vectors must be arrays')
    }
    if (
      p.contentVector.length !== contentLen ||
      p.metaVector.length !== metaLen
    ) {
      throw new Error(
        `upsertMultiVectorPoints: inconsistent vector lengths: content ${p.contentVector.length} vs ${contentLen}, meta ${p.metaVector.length} vs ${metaLen}`
      )
    }
    if (
      p.contentVector.some((v) => !Number.isFinite(v)) ||
      p.metaVector.some((v) => !Number.isFinite(v))
    ) {
      throw new Error(
        'upsertMultiVectorPoints: vectors contain non-finite numbers'
      )
    }
  }

  try {
    console.log(
      `🔼 [QDRANT] Upserting ${points.length} points (content dim=${contentLen}, meta dim=${metaLen})`
    )
    const preview = {
      id: points[0].id,
      contentSample: points[0].payload.content.slice(0, 80),
      metadataKeys: Object.keys(points[0].payload.metadata || {}),
    }
    console.log('🔼 [QDRANT] First point preview:', preview)

    await (
      qdrantClient as unknown as {
        upsert: (
          name: string,
          body: {
            points: Array<{
              id: string
              vectors: { content: number[]; meta: number[] }
              payload: Record<string, unknown>
            }>
          }
        ) => Promise<void>
      }
    ).upsert(QDRANT_COLLECTION_NAME, {
      points: points.map((p) => ({
        id: p.id,
        vectors: { content: p.contentVector, meta: p.metaVector },
        payload: {
          content: p.payload.content,
          metadata: p.payload.metadata || {},
        },
      })),
    })
    console.log('✅ [QDRANT] Upsert completed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ [QDRANT] Upsert failed:', msg)
    const anyErr = err as unknown as {
      response?: { data?: unknown }
      data?: unknown
    }
    if (anyErr && anyErr.response && anyErr.response.data) {
      try {
        console.error(
          '❌ [QDRANT] Error response data:',
          JSON.stringify(anyErr.response.data, null, 2)
        )
      } catch {
        console.error(
          '❌ [QDRANT] Error response data (raw):',
          anyErr.response.data
        )
      }
    }
    if (anyErr && anyErr.data !== undefined) {
      try {
        console.error(
          '❌ [QDRANT] Error data:',
          JSON.stringify(anyErr.data, null, 2)
        )
      } catch {
        console.error('❌ [QDRANT] Error data (raw):', anyErr.data)
      }
    }
    try {
      const debugPoint = points[0]
      console.error(
        '❌ [QDRANT] Debug first point:',
        JSON.stringify(
          {
            id: debugPoint.id,
            contentDim: debugPoint.contentVector.length,
            metaDim: debugPoint.metaVector.length,
            payloadMetaKeys: Object.keys(debugPoint.payload.metadata || {}),
          },
          null,
          2
        )
      )
    } catch {}
    throw err
  }
}

export async function searchMultiVector(
  queryContent: number[],
  queryMeta: number[],
  limit: number,
  contentWeight: number,
  metaWeight: number
): Promise<Document[]> {
  const qdrantClient = getClient()
  const [contentRes, metaRes] = await Promise.all([
    (
      qdrantClient as unknown as {
        search: (
          name: string,
          body: {
            vector: number[]
            limit: number
            with_payload: boolean
            using: 'content' | 'meta'
          }
        ) => Promise<
          Array<{
            id: string | number
            score: number
            payload?: Record<string, unknown>
          }>
        >
      }
    ).search(QDRANT_COLLECTION_NAME, {
      vector: queryContent,
      limit,
      with_payload: true,
      using: 'content',
    }),
    (
      qdrantClient as unknown as {
        search: (
          name: string,
          body: {
            vector: number[]
            limit: number
            with_payload: boolean
            using: 'content' | 'meta'
          }
        ) => Promise<
          Array<{
            id: string | number
            score: number
            payload?: Record<string, unknown>
          }>
        >
      }
    ).search(QDRANT_COLLECTION_NAME, {
      vector: queryMeta,
      limit,
      with_payload: true,
      using: 'meta',
    }),
  ])

  const scoreMap = new Map<
    string,
    { content?: number; meta?: number; payload?: Record<string, unknown> }
  >()
  for (const item of contentRes) {
    const id = String(item.id)
    const entry = scoreMap.get(id) || {}
    entry.content = item.score
    entry.payload = item.payload
    scoreMap.set(id, entry)
  }
  for (const item of metaRes) {
    const id = String(item.id)
    const entry = scoreMap.get(id) || {}
    entry.meta = item.score
    entry.payload = entry.payload || item.payload
    scoreMap.set(id, entry)
  }

  const merged = Array.from(scoreMap.entries())
    .map(([id, v]) => {
      const c = typeof v.content === 'number' ? v.content : 0
      const m = typeof v.meta === 'number' ? v.meta : 0
      const score = c * contentWeight + m * metaWeight
      return { id, score, payload: v.payload }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return merged.map((item) => ({
    id: item.id,
    content: String(item.payload?.content || ''),
    metadata: {
      ...(item.payload?.metadata as Record<string, unknown> | undefined),
      mv_score: item.score,
    } as DocumentMetadata,
  }))
}

export async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  const qdrantClient = getClient()

  for (const point of points) {
    await qdrantClient.upsert(QDRANT_COLLECTION_NAME, {
      points: [
        {
          id: point.id,
          vector: point.vector,
          payload: {
            content: point.payload.content,
            metadata: point.payload.metadata,
          },
        },
      ],
    })
  }
}

export async function searchSimilar(
  vector: number[],
  limit: number = 5,
  scoreThreshold: number = 0.7
): Promise<Document[]> {
  const qdrantClient = getClient()

  const response = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
    vector: vector,
    limit: limit,
    score_threshold: scoreThreshold,
    with_payload: true,
  })

  return response.map((item) => ({
    id: String(item.id),
    content: String(item.payload?.content || ''),
    metadata: item.payload?.metadata as DocumentMetadata | undefined,
  }))
}

export async function deleteCollection(): Promise<void> {
  try {
    const qdrantClient = getClient()
    await qdrantClient.deleteCollection(QDRANT_COLLECTION_NAME)
    console.log('Collection deleted successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('not found')) {
      console.log('Collection does not exist')
    } else {
      throw error
    }
  }
}
