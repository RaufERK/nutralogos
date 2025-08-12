import { getDatabase } from '@/lib/database'

export interface SystemStats {
  totalFiles: number
  totalSize: number
  library: {
    uploaded: number
    embedded: number
    duplicateContent: number
    failed: number
  }
  syncNeeded: boolean
  byFormat: Record<string, number>
  processingProgress: number
}

export async function getSystemStats(): Promise<SystemStats> {
  const db = await getDatabase()

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

  const statusMap = {
    uploaded: 0,
    embedded: 0,
    duplicateContent: 0,
    failed: 0,
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

  const byFormat: Record<string, number> = {}
  formatStats.forEach((stat) => {
    byFormat[stat.original_format.toUpperCase()] = stat.count
  })

  const processedFiles = statusMap.embedded + statusMap.duplicateContent
  const processingProgress =
    totalStats.totalFiles > 0
      ? Math.round((processedFiles / totalStats.totalFiles) * 100)
      : 0

  const syncNeeded = statusMap.uploaded > 0

  return {
    totalFiles: totalStats.totalFiles || 0,
    totalSize: totalStats.totalSize || 0,
    library: statusMap,
    syncNeeded,
    byFormat,
    processingProgress,
  }
}
