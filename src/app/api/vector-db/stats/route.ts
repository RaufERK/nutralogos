import { NextResponse } from 'next/server'
import { QdrantClient } from '@qdrant/js-client-rest'
import { getDatabase } from '@/lib/database'
import { SettingsService } from '@/lib/settings-service'

export async function GET() {
  try {
    const db = await getDatabase()

    const statusStats = db
      .prepare(
        `
        SELECT processing_status, COUNT(*) as count
        FROM processed_files
        GROUP BY processing_status
      `
      )
      .all() as Array<{ processing_status: string; count: number }>

    const totalFiles = db
      .prepare(`SELECT COUNT(*) as count FROM processed_files`)
      .get() as { count: number }

    const sqlite = {
      totalFiles: totalFiles.count,
      byStatus: Object.fromEntries(
        statusStats.map((s) => [s.processing_status, s.count])
      ) as Record<string, number>,
    }

    const url = process.env.QDRANT_URL
    const apiKey = process.env.QDRANT_API_KEY
    const collectionName = process.env.QDRANT_COLLECTION_NAME || 'nutralogos'

    if (!url) {
      return NextResponse.json({
        success: true,
        qdrant: {
          available: false,
          reason: 'QDRANT_URL is not set',
        },
        sqlite,
      })
    }

    const client = new QdrantClient({ url, apiKey })

    let exists = false
    let vectorsSize: number | null = null
    let distance: string | null = null
    let namedVectors: Record<
      string,
      { size?: number; distance?: string }
    > | null = null
    let pointsCount: number = 0

    try {
      const info = await client.getCollection(collectionName)
      exists = true
      const cfg = (
        info as unknown as {
          result?: {
            config?: {
              params?: { vectors?: unknown }
              vectors?: unknown
            }
          }
        }
      ).result?.config
      const vectorsRaw =
        (cfg?.params as unknown as { vectors?: unknown } | undefined)
          ?.vectors ??
        (cfg as unknown as { vectors?: unknown } | undefined)?.vectors

      if (vectorsRaw && typeof vectorsRaw === 'object') {
        const v = vectorsRaw as Record<string, unknown> & {
          size?: number
          distance?: string
        }
        if (typeof v.size === 'number') {
          vectorsSize = v.size
          distance = typeof v.distance === 'string' ? v.distance : 'Cosine'
        } else {
          namedVectors = Object.fromEntries(
            Object.entries(v).map(([key, val]) => {
              const entry = (val || {}) as { size?: number; distance?: string }
              return [key, { size: entry.size, distance: entry.distance }]
            })
          )
        }
      }

      try {
        const countRes = (await client.count(collectionName, {
          exact: true,
          filter: {},
        } as unknown as { exact: boolean; filter?: Record<string, unknown> })) as unknown as {
          result?: { count?: number }
        }
        pointsCount = Number(countRes?.result?.count || 0)
      } catch {
        try {
          const all = (await client.getCollections()) as unknown as {
            result?: Array<{
              name: string
              points_count?: number
              vectors_count?: number
            }>
          }
          const entry = all?.result?.find((c) => c.name === collectionName)
          pointsCount = Number(entry?.points_count || entry?.vectors_count || 0)
        } catch {
          pointsCount = 0
        }
      }
    } catch {
      exists = false
    }

    const multivectorEnabled = await SettingsService.getSettingValue<boolean>(
      'multivector_enabled',
      false
    )
    const contentWeight = await SettingsService.getSettingValue<number>(
      'multivector_content_weight',
      0.8
    )
    const metaWeight = await SettingsService.getSettingValue<number>(
      'multivector_meta_weight',
      0.2
    )

    // Derive vector sizes from embedding model if named vectors are enabled
    if (multivectorEnabled) {
      try {
        const embeddingModel = await SettingsService.getSettingValue<string>(
          'embedding_model',
          process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'
        )
        const dim = embeddingModel.includes('text-embedding-3-small')
          ? 1536
          : 3072
        namedVectors = {
          content: { size: dim, distance: 'Cosine' },
          meta: { size: dim, distance: 'Cosine' },
        }
        vectorsSize = null
        distance = null
      } catch {}
    }

    const embeddingModel = await SettingsService.getSettingValue<string>(
      'embedding_model',
      process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'
    )

    return NextResponse.json({
      success: true,
      qdrant: {
        available: true,
        collection: collectionName,
        exists,
        vectorsSize,
        distance,
        namedVectors,
        isNamedVectors: !!namedVectors,
        pointsCount,
        baseUrl: url,
        isSecure: typeof url === 'string' ? url.startsWith('https://') : false,
      },
      settings: {
        multivectorEnabled,
        multivectorContentWeight: contentWeight,
        multivectorMetaWeight: metaWeight,
        embeddingModel,
      },
      sqlite,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
