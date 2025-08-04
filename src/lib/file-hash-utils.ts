/**
 * Утилиты для вычисления хешей файлов и текстового содержимого
 * Используется для двухуровневой дедупликации в двухэтапной системе загрузки
 */

import crypto from 'crypto'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Вычисляет SHA-256 хеш для файла Buffer
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Вычисляет SHA-256 хеш для текстового содержимого
 */
export function calculateTextHash(text: string): string {
  // Нормализуем текст перед хешированием
  const normalizedText = normalizeTextForHashing(text)
  return crypto
    .createHash('sha256')
    .update(normalizedText, 'utf8')
    .digest('hex')
}

/**
 * Вычисляет SHA-256 хеш для файла по пути
 */
export async function calculateFileHashFromPath(
  filePath: string
): Promise<string> {
  const buffer = await readFile(filePath)
  return calculateFileHash(buffer)
}

/**
 * Нормализует текст для стабильного хеширования
 * Убирает лишние пробелы, переводы строк и приводит к единому формату
 */
export function normalizeTextForHashing(text: string): string {
  return (
    text
      // Заменяем все виды переводов строк на \n
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Убираем лишние пробелы в начале и конце строк
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Убираем множественные пустые строки
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Убираем пробелы в начале и конце всего текста
      .trim()
  )
}

/**
 * Генерирует префикс для хранения txt файлов на основе hash
 * Возвращает первые 2 символа хеша для создания подпапок
 */
export function getHashPrefix(hash: string): string {
  return hash.slice(0, 2).toLowerCase()
}

/**
 * Генерирует путь для хранения оригинального файла
 * Формат: /uploads/original/YYYY-MM-DD/filename
 */
export function generateOriginalFilePath(filename: string): string {
  const today = new Date()
  const dateFolder = today.toISOString().split('T')[0] // YYYY-MM-DD
  return join('uploads', 'original', dateFolder, filename)
}

/**
 * Генерирует пути для txt файла и метаданных на основе txt_hash
 * Возвращает объект с путями к txt и meta файлам
 */
export function generateTxtFilePaths(txtHash: string): {
  txtPath: string
  metaPath: string
  folder: string
} {
  const prefix = getHashPrefix(txtHash)
  const folder = join('uploads', 'txt', prefix)

  return {
    txtPath: join(folder, `${txtHash}.txt`),
    metaPath: join(folder, `${txtHash}.meta.json`),
    folder,
  }
}

/**
 * Санитизирует имя файла для безопасного хранения
 * Убирает опасные символы и ограничивает длину
 */
export function sanitizeFilename(filename: string): string {
  // Убираем путь, если есть
  const basename = filename.split(/[/\\]/).pop() || 'unknown'

  // Заменяем опасные символы на безопасные
  return basename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 255) // Ограничиваем длину
}

/**
 * Проверяет, существует ли файл с данным file_hash в базе
 */
export async function checkFileHashExists(fileHash: string): Promise<boolean> {
  const { getDatabase } = await import('./database')
  const db = await getDatabase()

  const result = db
    .prepare(
      'SELECT COUNT(*) as count FROM processed_files WHERE file_hash = ?'
    )
    .get(fileHash) as { count: number }

  return result.count > 0
}

/**
 * Проверяет, существует ли файл с данным txt_hash в базе
 */
export async function checkTxtHashExists(txtHash: string): Promise<{
  exists: boolean
  fileId?: number
  originalFilename?: string
}> {
  const { getDatabase } = await import('./database')
  const db = await getDatabase()

  const result = db
    .prepare(
      'SELECT id, original_filename FROM processed_files WHERE txt_hash = ?'
    )
    .get(txtHash) as { id: number; original_filename: string } | undefined

  if (result) {
    return {
      exists: true,
      fileId: result.id,
      originalFilename: result.original_filename,
    }
  }

  return { exists: false }
}

/**
 * Создает метаданные для файла
 */
export interface FileMetadata {
  file_hash: string
  txt_hash?: string
  original_filename: string
  original_format: string
  title?: string
  author?: string
  upload_date: string
  file_size: number
  text_length?: number
  pages?: number
  language?: string
  processing_time?: number
  chunks_created?: number
}

/**
 * Создает объект метаданных для файла
 */
export function createFileMetadata(
  fileHash: string,
  filename: string,
  fileSize: number,
  options: Partial<FileMetadata> = {}
): FileMetadata {
  const extension = filename.split('.').pop()?.toLowerCase() || 'unknown'

  return {
    file_hash: fileHash,
    original_filename: filename,
    original_format: extension,
    upload_date: new Date().toISOString(),
    file_size: fileSize,
    language: 'ru',
    ...options,
  }
}

/**
 * Сохраняет метаданные в JSON файл
 */
export async function saveMetadataFile(
  metaPath: string,
  metadata: FileMetadata
): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises')
  const { dirname } = await import('path')

  // Создаем папку если не существует
  await mkdir(dirname(metaPath), { recursive: true })

  // Сохраняем метаданные
  await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8')
}

/**
 * Загружает метаданные из JSON файла
 */
export async function loadMetadataFile(
  metaPath: string
): Promise<FileMetadata | null> {
  try {
    const { readFile } = await import('fs/promises')
    const content = await readFile(metaPath, 'utf8')
    return JSON.parse(content) as FileMetadata
  } catch {
    return null
  }
}
