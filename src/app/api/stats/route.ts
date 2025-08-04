import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

/**
 * API для получения статистики файлов в библиотеке
 * Используется админкой для отображения состояния системы
 */
export async function GET() {
  try {
    const db = await getDatabase()

    // Получаем общее количество файлов и размер
    const totalStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalFiles,
        SUM(file_size) as totalSize
      FROM processed_files
    `
      )
      .get() as { totalFiles: number; totalSize: number }

    // Получаем статистику по статусам
    const statusStats = db
      .prepare(
        `
      SELECT 
        processing_status,
        COUNT(*) as count
      FROM processed_files 
      GROUP BY processing_status
    `
      )
      .all() as Array<{ processing_status: string; count: number }>

    // Получаем статистику по форматам
    const formatStats = db
      .prepare(
        `
      SELECT 
        original_format,
        COUNT(*) as count
      FROM processed_files 
      GROUP BY original_format
      ORDER BY count DESC
    `
      )
      .all() as Array<{ original_format: string; count: number }>

    // Собираем статистику по статусам в удобный формат
    const statusMap = {
      uploaded: 0, // original_uploaded
      embedded: 0, // embedded
      duplicateContent: 0, // duplicate_content
      failed: 0, // failed
    }

    statusStats.forEach((stat) => {
      switch (stat.processing_status) {
        case 'original_uploaded':
          statusMap.uploaded = stat.count
          break
        case 'embedded':
          statusMap.embedded = stat.count
          break
        case 'duplicate_content':
          statusMap.duplicateContent = stat.count
          break
        case 'failed':
          statusMap.failed = stat.count
          break
      }
    })

    // Собираем статистику по форматам в удобный формат
    const byFormat: Record<string, number> = {}
    formatStats.forEach((stat) => {
      byFormat[stat.original_format.toUpperCase()] = stat.count
    })

    // Вычисляем прогресс обработки
    const processedFiles = statusMap.embedded + statusMap.duplicateContent
    const processingProgress =
      totalStats.totalFiles > 0
        ? Math.round((processedFiles / totalStats.totalFiles) * 100)
        : 0

    // Определяем, нужна ли синхронизация
    const syncNeeded = statusMap.uploaded > 0

    const stats = {
      totalFiles: totalStats.totalFiles || 0,
      totalSize: totalStats.totalSize || 0,
      library: statusMap,
      syncNeeded,
      byFormat,
      processingProgress,
    }

    console.log('📊 [STATS] Generated statistics:', {
      totalFiles: stats.totalFiles,
      syncNeeded: stats.syncNeeded,
      processingProgress: stats.processingProgress,
    })

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('❌ [STATS] Error generating statistics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate statistics',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
