import path from 'path'

export interface DocumentProcessor {
  supportedMimeTypes: string[]
  supportedExtensions: string[]
  extractText(filePath: string, buffer: Buffer): Promise<string>
  validateFile(buffer: Buffer): boolean
}

export class TXTProcessor implements DocumentProcessor {
  supportedMimeTypes = ['text/plain', 'text/txt', 'application/txt']
  supportedExtensions = ['.txt']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8')
  }

  validateFile(buffer: Buffer): boolean {
    // Простая проверка на текстовый файл
    const text = buffer.toString('utf-8', 0, Math.min(1000, buffer.length))
    // Проверяем что файл содержит в основном печатные символы
    const printableChars = text.replace(/[\r\n\t]/g, '').length
    const totalChars = text.replace(/[\r\n\t]/g, '').length
    return printableChars / Math.max(totalChars, 1) > 0.7
  }
}

export class PDFProcessor implements DocumentProcessor {
  supportedMimeTypes = ['application/pdf']
  supportedExtensions = ['.pdf']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    const normalize = (text: string) =>
      text
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .split('\n')
        .map((l) => l.replace(/[ \t]+$/g, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    const extractWithPath = (pdfPath: string) =>
      new Promise<string>(async (resolve, reject) => {
        try {
          const mod = await import('pdf-text-extract')
          const modDefault = (mod as unknown as { default?: unknown }).default
          const extractCandidate = (modDefault ?? (mod as unknown)) as unknown
          const extract = extractCandidate as (
            path: string,
            opts: { splitPages: boolean },
            cb: (err: unknown, text: string | string[]) => void
          ) => void
          const options = { splitPages: false }
          extract(pdfPath, options, (err: unknown, text: string | string[]) => {
            if (err) return reject(err)
            const joined = Array.isArray(text) ? text.join('\n\n') : text
            resolve(normalize(joined || ''))
          })
        } catch (e) {
          reject(e)
        }
      })

    const fs = await import('fs/promises')
    const os = await import('os')
    const pathMod = await import('path')

    let tempFile: string | null = null
    try {
      const hasPath = filePath && filePath.length > 0
      if (hasPath) {
        try {
          await fs.stat(filePath)
          const text = await extractWithPath(filePath)
          if (text && text.trim()) return text
        } catch {}
      }

      const tmpDir = await fs.mkdtemp(pathMod.join(os.tmpdir(), 'pdfx-'))
      tempFile = pathMod.join(tmpDir, 'input.pdf')
      await fs.writeFile(tempFile, buffer)
      const text = await extractWithPath(tempFile)
      return text
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`PDF processing failed: ${msg}`)
    } finally {
      if (tempFile) {
        try {
          const { dirname } = await import('path')
          await fs.unlink(tempFile)
          await fs.rmdir(dirname(tempFile)).catch(() => {})
        } catch {}
      }
    }
  }

  validateFile(buffer: Buffer): boolean {
    // PDF файлы начинаются с %PDF
    return buffer.subarray(0, 4).toString() === '%PDF'
  }
}

export class DOCXProcessor implements DocumentProcessor {
  supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  supportedExtensions = ['.docx']

  async extractText(filePath: string, buffer: Buffer): Promise<string> {
    try {
      // Динамический импорт
      const mammoth = await import('mammoth')
      const result = await (
        mammoth as unknown as {
          extractRawText: (opts: {
            buffer: Buffer
          }) => Promise<{ value: string }>
        }
      ).extractRawText({ buffer })
      return result.value
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`DOCX processing failed: ${msg}`)
    }
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
    try {
      // Динамический импорт
      const WordExtractor = await import('word-extractor')
      const ExtractorCtor = ((WordExtractor as unknown as { default?: unknown })
        .default ?? (WordExtractor as unknown)) as new () => {
        extract: (buf: unknown) => Promise<{
          getBody(): string
          getFootnotes(): string
          getEndnotes(): string
        }>
      }
      const extractor = new ExtractorCtor()
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`DOC processing failed: ${msg}`)
    }
  }

  validateFile(buffer: Buffer): boolean {
    // DOC файлы имеют определенную сигнатуру
    const signature = buffer.subarray(0, 8)
    // MS Word DOC файлы начинаются с определенных байтов
    return (
      signature[0] === 0xd0 &&
      signature[1] === 0xcf &&
      signature[2] === 0x11 &&
      signature[3] === 0xe0
    )
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

    return (
      this.processors.find((processor) => {
        const extensionMatch = processor.supportedExtensions.includes(extension)
        const mimeMatch = mimeType
          ? processor.supportedMimeTypes.includes(mimeType)
          : false
        return extensionMatch || mimeMatch
      }) || null
    )
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
