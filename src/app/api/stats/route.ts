import { NextResponse } from 'next/server'
import { getSystemStats } from '@/lib/stats'

/**
 * API для получения статистики файлов в библиотеке
 * Используется админкой для отображения состояния системы
 */
export async function GET() {
  try {
    const stats = await getSystemStats()

    console.log('📊 [STATS] Generated statistics:', {
      totalFiles: stats.totalFiles,
      syncNeeded: stats.syncNeeded,
      processingProgress: stats.processingProgress,
    })

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error: unknown) {
    console.error('❌ [STATS] Error generating statistics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate statistics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
