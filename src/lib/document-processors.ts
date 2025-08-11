import path from 'path'
/* Legacy processor removed: use document-processors-clean instead */
// This file is kept only to avoid import breakage. Prefer document-processors-clean.
import mammoth from 'mammoth'
import WordExtractorMod from 'word-extractor'
const WordExtractor = ((WordExtractorMod as unknown as { default?: unknown })
  .default ?? (WordExtractorMod as unknown)) as new () => {
  extract: (buf: unknown) => Promise<{
    getBody(): string
    getFootnotes(): string
    getEndnotes(): string
  }>
}

export interface DocumentProcessor {
  supportedMimeTypes: string[]
  supportedExtensions: string[]
  extractText(filePath: string, buffer: Buffer): Promise<string>
  validateFile(buffer: Buffer): boolean
}

// PDF parsing is handled in document-processors-clean via pdf-text-extract
export class PDFProcessor implements DocumentProcessor {
  supportedMimeTypes = ['application/pdf']
  supportedExtensions = ['.pdf']
  async extractText(): Promise<string> {
    throw new Error('Use document-processors-clean PDFProcessor')
  }
  validateFile(): boolean {
    return false
  }
}

export class TXTProcessor implements DocumentProcessor {
  supportedMimeTypes = ['text/plain']
  supportedExtensions = ['.txt']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8')
  }

  validateFile(buffer: Buffer): boolean {
    try {
      buffer.toString('utf-8')
      return true
    } catch {
      return false
    }
  }
}

export class DOCXProcessor implements DocumentProcessor {
  supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  supportedExtensions = ['.docx']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    const result = await (
      mammoth as unknown as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
      }
    ).extractRawText({ buffer })
    return result.value
  }

  validateFile(buffer: Buffer): boolean {
    // DOCX файлы это ZIP архивы с определенной структурой
    return buffer.subarray(0, 4).toString('hex') === '504b0304'
  }
}

export class DOCProcessor implements DocumentProcessor {
  supportedMimeTypes = ['application/msword', 'application/vnd.ms-word']
  supportedExtensions = ['.doc']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    const extractor = new WordExtractor()
    const extracted = await extractor.extract(buffer as unknown as string)
    const body = extracted.getBody()

    // Также извлекаем footnotes и endnotes если есть
    const footnotes = extracted.getFootnotes()
    const endnotes = extracted.getEndnotes()

    let fullText = body
    if (footnotes && footnotes.trim()) {
      fullText += '\n\n--- Footnotes ---\n' + footnotes
    }
    if (endnotes && endnotes.trim()) {
      fullText += '\n\n--- Endnotes ---\n' + endnotes
    }

    return fullText
  }

  validateFile(buffer: Buffer): boolean {
    // DOC файлы начинаются с OLE заголовка
    const header = buffer.subarray(0, 8).toString('hex')
    return header === 'd0cf11e0a1b11ae1' // OLE signature
  }
}

// Фабрика процессоров
export class DocumentProcessorFactory {
  private processors: DocumentProcessor[] = [
    new PDFProcessor(),
    new TXTProcessor(),
    new DOCXProcessor(),
    new DOCProcessor(),
  ]

  getProcessor(fileName: string, mimeType?: string): DocumentProcessor | null {
    const extension = path.extname(fileName).toLowerCase()

    // Сначала ищем по MIME типу
    if (mimeType) {
      const processor = this.processors.find((p) =>
        p.supportedMimeTypes.includes(mimeType)
      )
      if (processor) return processor
    }

    // Затем по расширению файла
    const processor = this.processors.find((p) =>
      p.supportedExtensions.includes(extension)
    )

    return processor || null
  }

  getSupportedExtensions(): string[] {
    return this.processors.flatMap((p) => p.supportedExtensions)
  }

  getSupportedMimeTypes(): string[] {
    return this.processors.flatMap((p) => p.supportedMimeTypes)
  }

  isSupported(fileName: string, mimeType?: string): boolean {
    return this.getProcessor(fileName, mimeType) !== null
  }
}

export const documentProcessorFactory = new DocumentProcessorFactory()

/**
 * Универсальная функция для извлечения текста из файла
 * Использует соответствующий процессор для каждого формата
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  const fileName = path.basename(filePath)
  const processor = documentProcessorFactory.getProcessor(fileName)

  if (!processor) {
    throw new Error(`Unsupported file format: ${fileName}`)
  }

  // Читаем файл для валидации
  const fs = await import('fs/promises')
  const buffer = await fs.readFile(filePath)

  // Валидируем файл
  if (!processor.validateFile(buffer)) {
    throw new Error(`Invalid file format: ${fileName}`)
  }

  // Извлекаем текст
  return await processor.extractText(filePath, buffer)
}
