import Database from 'better-sqlite3'
import { join } from 'path'

function getSettingSync(name: string, fallback: number): number {
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data')
    const dbPath = join(dataDir, 'rag-chat.db')
    const db = new Database(dbPath)
    const row = db
      .prepare(
        'SELECT parameter_value, parameter_type FROM system_settings WHERE parameter_name = ?'
      )
      .get(name) as
      | { parameter_value: string; parameter_type: string }
      | undefined
    if (!row) return fallback
    if (row.parameter_type === 'number') {
      const n = parseFloat(row.parameter_value)
      return Number.isNaN(n) ? fallback : n
    }
    const n = parseFloat(row.parameter_value)
    return Number.isNaN(n) ? fallback : n
  } catch {
    return fallback
  }
}

const CHUNK_SIZE_DB = getSettingSync('chunk_size', 3000)
const CHUNK_OVERLAP_DB = getSettingSync('chunk_overlap', 600)
const MAX_FILE_SIZE_MB_DB = getSettingSync('max_file_size_mb', 50)
const MAX_CHUNKS_PER_FILE_DB = getSettingSync('max_chunks_per_file', 50)

export const FILE_CONFIG = {
  // Пути
  UPLOADS_DIR: process.env.UPLOADS_DIR || 'uploads',
  TEMP_DIR: join(process.env.UPLOADS_DIR || 'uploads', 'temp'),
  PROCESSING_DIR: join(
    process.env.UPLOADS_DIR || 'uploads',
    'temp',
    'processing'
  ),
  CLEANUP_DIR: join(process.env.UPLOADS_DIR || 'uploads', 'temp', 'cleanup'),
  BACKUPS_DIR: join(process.env.UPLOADS_DIR || 'uploads', 'backups'),
  LOGS_DIR: join(process.env.UPLOADS_DIR || 'uploads', 'logs'),

  // Ограничения
  MAX_FILE_SIZE: Math.max(1, Math.floor(MAX_FILE_SIZE_MB_DB)) * 1024 * 1024,
  MAX_FILES_PER_DAY: 50, // Reduced for stability
  ALLOWED_MIME_TYPES: [
    'application/pdf', // ✅ PDF - через pdf-text-extract
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // ✅ DOCX - через mammoth
    'text/plain', // ✅ TXT - нативный Node.js
    // legacy formats (epub/fb2/xml) removed
    'application/msword', // ✅ DOC - через word-extractor
    'application/vnd.ms-word', // ✅ DOC альтернативный MIME - через word-extractor
  ],

  // Настройки чанкинга - из БД
  CHUNK_SIZE: Math.max(100, Math.floor(CHUNK_SIZE_DB)),
  CHUNK_OVERLAP: Math.max(0, Math.floor(CHUNK_OVERLAP_DB)),
  chunkSize: Math.max(100, Math.floor(CHUNK_SIZE_DB)),
  chunkOverlap: Math.max(0, Math.floor(CHUNK_OVERLAP_DB)),

  // Очистка
  CLEANUP_DAYS: 7, // Удалять файлы старше 7 дней - уменьшено
  BACKUP_DAYS: 3, // Хранить бэкапы 3 дня - уменьшено

  // Валидация
  MIN_FILE_SIZE: 1024, // 1KB
  MAX_FILENAME_LENGTH: 255,

  // Новые ограничения - ОПТИМИЗИРОВАНЫ для больших чанков
  MAX_CHUNKS_PER_FILE: Math.max(1, Math.floor(MAX_CHUNKS_PER_FILE_DB)),
  MAX_TEXT_LENGTH: 200000, // Максимум символов в тексте (увеличено для больших файлов)
} as const

export type AllowedMimeType = (typeof FILE_CONFIG.ALLOWED_MIME_TYPES)[number]
