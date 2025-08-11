import fs from 'fs/promises'
import path from 'path'
import { FILE_CONFIG } from './file-config'
import { randomUUID } from 'crypto'

export class FileUtils {
  /**
   * Создает структуру папок для даты
   */
  static async createDateFolders(date: Date = new Date()): Promise<string> {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    const datePath = path.join(
      FILE_CONFIG.UPLOADS_DIR,
      String(year),
      month,
      day
    )

    await fs.mkdir(datePath, { recursive: true })
    return datePath
  }

  /**
   * Генерирует уникальное имя файла
   */
  static generateFilename(originalName: string): string {
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    const uuid = randomUUID()

    // Ограничиваем длину имени файла
    const maxBaseLength =
      FILE_CONFIG.MAX_FILENAME_LENGTH - ext.length - uuid.length - 2
    const truncatedBase =
      baseName.length > maxBaseLength
        ? baseName.substring(0, maxBaseLength)
        : baseName

    return `${truncatedBase}_${uuid}${ext}`
  }

  /**
   * Получает путь для файла по дате
   */
  static getFilePath(filename: string, date: Date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return path.join(
      FILE_CONFIG.UPLOADS_DIR,
      String(year),
      month,
      day,
      filename
    )
  }

  /**
   * Проверяет свободное место на диске
   */
  static async checkDiskSpace(): Promise<{
    free: number
    total: number
    used: number
    percentage: number
  }> {
    // Для Node.js нужно использовать внешнюю библиотеку
    // Например: diskusage или node-disk-info
    // Пока возвращаем заглушку
    return {
      free: 1024 * 1024 * 1024 * 10, // 10GB
      total: 1024 * 1024 * 1024 * 100, // 100GB
      used: 1024 * 1024 * 1024 * 90, // 90GB
      percentage: 90,
    }
  }

  /**
   * Валидирует файл
   */
  static validateFile(file: {
    size: number
    mimetype: string
    originalname: string
  }): { valid: boolean; error?: string } {
    // Проверка размера
    if (file.size < FILE_CONFIG.MIN_FILE_SIZE) {
      return { valid: false, error: 'Файл слишком маленький' }
    }

    if (file.size > FILE_CONFIG.MAX_FILE_SIZE) {
      return { valid: false, error: 'Файл слишком большой' }
    }

    // Проверка типа
    if (
      !FILE_CONFIG.ALLOWED_MIME_TYPES.includes(
        file.mimetype as unknown as (typeof FILE_CONFIG.ALLOWED_MIME_TYPES)[number]
      )
    ) {
      return { valid: false, error: 'Неподдерживаемый тип файла' }
    }

    // Проверка имени файла
    if (file.originalname.length > FILE_CONFIG.MAX_FILENAME_LENGTH) {
      return { valid: false, error: 'Имя файла слишком длинное' }
    }

    return { valid: true }
  }

  /**
   * Создает временную папку для обработки
   */
  static async createTempFolder(): Promise<string> {
    const tempId = randomUUID()
    const tempPath = path.join(FILE_CONFIG.PROCESSING_DIR, tempId)

    await fs.mkdir(tempPath, { recursive: true })
    return tempPath
  }

  /**
   * Перемещает файл в финальную папку
   */
  static async moveToFinalLocation(
    tempPath: string,
    finalPath: string
  ): Promise<void> {
    await fs.mkdir(path.dirname(finalPath), { recursive: true })
    await fs.rename(tempPath, finalPath)
  }

  /**
   * Безопасно удаляет файл
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Логируем ошибку, но не падаем
      console.error(`Error deleting file ${filePath}:`, error)
    }
  }

  /**
   * Получает размер папки
   */
  static async getFolderSize(folderPath: string): Promise<number> {
    let totalSize = 0

    const files = await fs.readdir(folderPath, { withFileTypes: true })

    for (const file of files) {
      const filePath = path.join(folderPath, file.name)

      if (file.isDirectory()) {
        totalSize += await this.getFolderSize(filePath)
      } else {
        const stats = await fs.stat(filePath)
        totalSize += stats.size
      }
    }

    return totalSize
  }
}
