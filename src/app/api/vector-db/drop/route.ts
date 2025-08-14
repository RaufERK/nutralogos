import { NextResponse } from 'next/server'
import { QdrantClient } from '@qdrant/js-client-rest'
import { getDatabase } from '@/lib/database'

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

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    })

    const db = await getDatabase()
    const result = db
      .prepare(
        `
      UPDATE processed_files
      SET processing_status = 'original_uploaded',
          embedded_at = NULL,
          processed_at = NULL,
          processing_time_ms = NULL,
          chunks_created = 0
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
