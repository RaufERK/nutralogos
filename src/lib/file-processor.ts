import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { TextSplitter } from './text-splitter'
import { FILE_CONFIG } from './file-config'
import { documentProcessorFactory } from './document-processors'

export interface ProcessedFile {
  text: string
  chunks: Array<{
    content: string
    index: number
  }>
  metadata: {
    pages?: number
    title?: string
    author?: string
    subject?: string
    keywords?: string[]
    format?: string
    processor?: string
  }
}

export class FileProcessor {
  /**
   * Обрабатывает файл используя универсальные процессоры
   */
  static async processFile(
    filePath: string,
    mimeType: string
  ): Promise<ProcessedFile> {
    try {
      console.log(`[FileProcessor] Начинаем обработку файла: ${filePath}`)

      // Проверяем существование файла
      try {
        await fs.access(filePath)
        console.log(`[FileProcessor] Файл существует и доступен для чтения`)
      } catch {
        throw new Error(`Файл не найден или недоступен: ${filePath}`)
      }

      // Читаем файл
      console.log(`[FileProcessor] Читаем файл...`)
      const dataBuffer = await fs.readFile(filePath)
      console.log(
        `[FileProcessor] Файл прочитан, размер буфера: ${dataBuffer.length} байт`
      )

      // Получаем имя файла из пути
      const fileName = path.basename(filePath)

      // Получаем подходящий процессор
      const processor = documentProcessorFactory.getProcessor(fileName, mimeType)
      if (!processor) {
        throw new Error(`Неподдерживаемый тип файла: ${mimeType} (${fileName})`)
      }

      console.log(`[FileProcessor] Используем процессор: ${processor.constructor.name}`)

      // Валидируем файл
      if (!processor.validateFile(dataBuffer)) {
        throw new Error(`Некорректный или поврежденный файл: ${fileName}`)
      }

      // Извлекаем текст
      console.log(`[FileProcessor] Извлекаем текст...`)
      const extractedText = await processor.extractText(filePath, dataBuffer)

      if (!extractedText.trim()) {
        throw new Error(`Файл не содержит текстового содержимого: ${fileName}`)
      }

      console.log(`[FileProcessor] Текст извлечен, длина: ${extractedText.length} символов`)

      // Очищаем текст
      const cleanText = TextSplitter.cleanText(extractedText)
      console.log(`[FileProcessor] Текст очищен, длина: ${cleanText.length} символов`)

      // Разбиваем на чанки
      const chunks = TextSplitter.smartSplit(cleanText)
      console.log(`[FileProcessor] Создано ${chunks.length} чанков`)

      // Определяем формат
      const format = path.extname(fileName).toLowerCase().substring(1)

      return {
        text: cleanText,
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          index: chunk.index,
        })),
        metadata: {
          format,
          processor: processor.constructor.name,
        },
      }
    } catch (error) {
      console.error(`[FileProcessor] Ошибка обработки файла:`, error)
      throw new Error(
        `Ошибка обработки файла: ${
          error instanceof Error ? error.message : 'Неизвестная ошибка'
        }`
      )
    }
  }

  /**
   * Проверяет, поддерживается ли тип файла
   */
  static isSupportedFileType(mimeType: string): boolean {
    return documentProcessorFactory.getSupportedMimeTypes().includes(mimeType)
  }

  /**
   * Получает расширение файла по MIME типу
   */
  static getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'application/epub+zip': '.epub',
      'application/x-fictionbook+xml': '.fb2',
      'text/xml': '.fb2',
      'application/xml': '.fb2',
    }

    return extensions[mimeType] || ''
  }

  /**
   * Валидирует содержимое файла
   */
  static validateFileContent(
    filePath: string,
    mimeType: string
  ): { valid: boolean; error?: string } {
    try {
      // Проверяем размер файла
      const stats = fsSync.statSync(filePath)

      if (stats.size === 0) {
        return { valid: false, error: 'Файл пустой' }
      }

      if (stats.size > FILE_CONFIG.MAX_FILE_SIZE) {
        return { valid: false, error: `Файл слишком большой. Максимальный размер: ${FILE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB` }
      }

      // Читаем первые байты для валидации
      const buffer = fsSync.readFileSync(filePath)
      const fileName = path.basename(filePath)
      
      // Получаем процессор для валидации
      const processor = documentProcessorFactory.getProcessor(fileName, mimeType)
      if (!processor) {
        return { valid: false, error: `Неподдерживаемый тип файла: ${mimeType}` }
      }

      // Валидируем файл через процессор
      if (!processor.validateFile(buffer)) {
        return { valid: false, error: `Некорректный формат файла: ${fileName}` }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: 'Ошибка валидации файла' }
    }
  }

  /**
   * Получает список поддерживаемых расширений
   */
  static getSupportedExtensions(): string[] {
    return documentProcessorFactory.getSupportedExtensions()
  }

  /**
   * Получает список поддерживаемых MIME типов
   */
  static getSupportedMimeTypes(): string[] {
    return documentProcessorFactory.getSupportedMimeTypes()
  }
}
