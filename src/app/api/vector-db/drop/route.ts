import { NextResponse } from 'next/server'
import { QdrantClient } from '@qdrant/js-client-rest'
import { getDatabase } from '@/lib/database'
import { SettingsService } from '@/lib/settings-service'

export async function POST() {
  try {
    const url = process.env.QDRANT_URL
    const apiKey = process.env.QDRANT_API_KEY
    const collectionName = process.env.QDRANT_COLLECTION_NAME || 'nutralogos'

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'QDRANT_URL is not set' },
        { status: 400 }
      )
    }

    const client = new QdrantClient({ url, apiKey })

    try {
      await client.deleteCollection(collectionName)
    } catch {
      // ignore if not exists
    }

    // Determine vector size from embedding model
    let vectorSize = 3072
    try {
      const embeddingModel = await SettingsService.getSettingValue<string>(
        'embedding_model',
        process.env.OPENAI_EMBEDDING_MODEL ||
          process.env.NEXT_PUBLIC_OPENAI_EMBEDDING_MODEL ||
          'text-embedding-3-large'
      )
      vectorSize = embeddingModel.includes('text-embedding-3-small')
        ? 1536
        : 3072
    } catch {}

    const multivectorEnabled = await SettingsService.getSettingValue<boolean>(
      'multivector_enabled',
      false
    )
    if (multivectorEnabled) {
      await (
        client as unknown as {
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
      ).createCollection(collectionName, {
        vectors: {
          content: { size: vectorSize, distance: 'Cosine' },
          meta: { size: vectorSize, distance: 'Cosine' },
        },
      })
    } else {
      await client.createCollection(collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      })
    }

    const db = await getDatabase()
    const result = db
      .prepare(
        `
      UPDATE processed_files
      SET processing_status = 'original_uploaded',
          embedded_at = NULL,
          processed_at = NULL,
          processing_time_ms = NULL,
          chunks_created = 0,
          txt_hash = NULL,
          txt_path = NULL,
          metadata_json = NULL,
          error_message = NULL
      WHERE processing_status IN ('embedded','duplicate_content','failed')
    `
      )
      .run()

    return NextResponse.json({
      success: true,
      message: 'Vector DB reset completed',
      updatedRows: result.changes || 0,
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
