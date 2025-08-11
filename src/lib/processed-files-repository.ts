import { getDatabase } from './database'

export interface ProcessedFileRecord {
  id: number
  file_hash: string
  original_filename: string
  file_size: number
  mime_type: string
  processing_status:
    | 'original_uploaded'
    | 'embedded'
    | 'duplicate_content'
    | 'failed'
  chunks_created: number
  embeddings_created: number
  processing_time_ms: number | null
  error_message: string | null
  uploaded_by: number | null
  uploaded_at: string
  processed_at: string | null
  metadata_json: string | null
  txt_hash: string | null
  storage_path: string | null
  txt_path: string | null
  meta_path: string | null
  embedded_at: string | null
  title: string | null
  author: string | null
  language: string
  original_format: string
  text_length: number | null
}

export class ProcessedFilesRepository {
  static async getAllFiles(): Promise<ProcessedFileRecord[]> {
    const db = await getDatabase()

    const files = db
      .prepare('SELECT * FROM processed_files ORDER BY uploaded_at DESC')
      .all() as ProcessedFileRecord[]

    return files
  }

  static async getFilesPaginated(
    page: number = 1,
    limit: number = 20,
    statusFilter?: string
  ): Promise<{
    files: ProcessedFileRecord[]
    total: number
    pages: number
    currentPage: number
  }> {
    const db = await getDatabase()
    const offset = (page - 1) * limit

    let whereClause = ''
    const params: Array<string | number> = []

    if (statusFilter && statusFilter !== 'all') {
      whereClause = 'WHERE processing_status = ?'
      params.push(statusFilter)
    }

    // Получаем общее количество файлов
    const totalResult = db
      .prepare(`SELECT COUNT(*) as total FROM processed_files ${whereClause}`)
      .get(params) as { total: number }
    const total = totalResult.total

    // Получаем файлы с пагинацией
    const files = db
      .prepare(
        `
        SELECT * FROM processed_files 
        ${whereClause}
        ORDER BY uploaded_at DESC 
        LIMIT ? OFFSET ?
      `
      )
      .all([...params, limit, offset]) as ProcessedFileRecord[]

    return {
      files,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    }
  }

  static async getStats(): Promise<{
    totalFiles: number
    totalSize: number
    originalFilesSize: number
    txtFilesSize: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }> {
    const db = await getDatabase()

    const stats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalFiles,
        SUM(file_size) as totalSize
      FROM processed_files
    `
      )
      .get() as { totalFiles: number; totalSize: number }

    const byStatus = db
      .prepare(
        `
      SELECT processing_status, COUNT(*) as count
      FROM processed_files
      GROUP BY processing_status
    `
      )
      .all() as Array<{ processing_status: string; count: number }>

    const byType = db
      .prepare(
        `
      SELECT original_format, COUNT(*) as count
      FROM processed_files
      GROUP BY original_format
    `
      )
      .all() as Array<{ original_format: string; count: number }>

    // Получаем размер оригинальных файлов
    const originalStats = db
      .prepare(
        `
      SELECT SUM(file_size) as originalFilesSize
      FROM processed_files
    `
      )
      .get() as { originalFilesSize: number }

    // Приблизительный размер txt файлов (30% от оригинала для текстовых файлов)
    const txtStats = db
      .prepare(
        `
      SELECT SUM(
        CASE 
          WHEN text_length IS NOT NULL THEN text_length 
          ELSE file_size * 0.3 
        END
      ) as txtFilesSize
      FROM processed_files
    `
      )
      .get() as { txtFilesSize: number }

    return {
      totalFiles: stats.totalFiles || 0,
      totalSize: stats.totalSize || 0,
      originalFilesSize: originalStats.originalFilesSize || 0,
      txtFilesSize: txtStats.txtFilesSize || 0,
      byStatus: Object.fromEntries(
        byStatus.map((s) => [s.processing_status, s.count])
      ),
      byType: Object.fromEntries(
        byType.map((t) => [t.original_format, t.count])
      ),
    }
  }

  static async deleteFile(id: number): Promise<void> {
    const db = await getDatabase()
    db.prepare('DELETE FROM processed_files WHERE id = ?').run(id)
  }

  static async getFileById(id: number): Promise<ProcessedFileRecord | null> {
    const db = await getDatabase()

    const file = db
      .prepare('SELECT * FROM processed_files WHERE id = ?')
      .get(id) as ProcessedFileRecord | undefined

    return file || null
  }
}
