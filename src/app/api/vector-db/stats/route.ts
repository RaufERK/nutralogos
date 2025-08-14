import { NextResponse } from 'next/server'
import { QdrantClient } from '@qdrant/js-client-rest'
import { getDatabase } from '@/lib/database'

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
    let vectorsSize: number = 1536
    let distance: string = 'Cosine'
    let pointsCount: number = 0

    try {
      const info = await client.getCollection(collectionName)
      exists = true
      const cfg = (
        info as unknown as {
          result?: {
            config?: {
              params?: { vectors?: { size?: number; distance?: string } }
              vectors?: { size?: number; distance?: string }
            }
          }
        }
      ).result?.config
      const vectors =
        (
          cfg?.params as unknown as
            | { vectors?: { size?: number; distance?: string } }
            | undefined
        )?.vectors ||
        (
          cfg as unknown as
            | { vectors?: { size?: number; distance?: string } }
            | undefined
        )?.vectors
      if (vectors?.size) vectorsSize = vectors.size
      if (vectors?.distance) distance = vectors.distance

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

    return NextResponse.json({
      success: true,
      qdrant: {
        available: true,
        collection: collectionName,
        exists,
        vectorsSize,
        distance,
        pointsCount,
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
