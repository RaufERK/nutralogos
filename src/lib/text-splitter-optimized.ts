import { FILE_CONFIG } from './file-config'

export interface TextChunk {
  content: string
  index: number
  start: number
  end: number
  tokenCount?: number
}

export interface ChunkingOptions {
  chunkSize?: number // в токенах
  chunkOverlap?: number // в токенах
  preserveStructure?: boolean // сохранять структуру предложений/абзацев
}

export class OptimizedTextSplitter {
  /**
   * Подсчет токенов для текста (fallback без tiktoken)
   * Использует эмпирическую формулу для оценки количества токенов
   */
  static countTokens(text: string): number {
    // Более точная оценка токенов для разных языков
    // Основано на анализе OpenAI tokenizer

    // Подсчитываем разные типы символов
    const russianChars = (text.match(/[а-яё]/gi) || []).length
    const englishWords = (text.match(/\b[a-z]+\b/gi) || []).length
    const numbers = (text.match(/\d+/g) || []).length
    const punctuation = (
      text.match(/[.,!?;:()[\]{}"'`~@#$%^&*+=<>\/\\|_-]/g) || []
    ).length
    const spaces = (text.match(/\s/g) || []).length

    // Эмпирические коэффициенты для разных типов контента
    let estimatedTokens = 0

    // Русские символы: ~2.5 символа на токен
    estimatedTokens += russianChars / 2.5

    // Английские слова: ~0.75 токена на слово
    estimatedTokens += englishWords * 0.75

    // Числа: обычно 1 токен на число
    estimatedTokens += numbers

    // Пунктуация: ~0.5 токена на символ
    estimatedTokens += punctuation * 0.5

    // Пробелы обычно не считаются отдельными токенами

    // Минимум 1 токен для непустого текста
    return Math.max(1, Math.ceil(estimatedTokens))
  }

  /**
   * Оптимизированная разбивка текста на чанки по токенам
   * Основано на рекомендациях OpenAI для embeddings
   */
  static async splitTextOptimized(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<TextChunk[]> {
    // Загружаем актуальные настройки из базы данных
    const { SettingsService } = await import('./settings-service')
    const defaultChunkSize = await SettingsService.getSettingValue(
      'chunk_size',
      1000
    )
    const defaultChunkOverlap = await SettingsService.getSettingValue(
      'chunk_overlap',
      200
    )
    const defaultPreserveStructure = await SettingsService.getSettingValue(
      'preserve_text_structure',
      true
    )

    const {
      chunkSize = defaultChunkSize, // Из настроек chunk_size
      chunkOverlap = defaultChunkOverlap, // Из настроек chunk_overlap
      preserveStructure = defaultPreserveStructure, // Из настроек preserve_text_structure
    } = options

    // Memory protection
    if (text.length > FILE_CONFIG.MAX_TEXT_LENGTH) {
      console.warn(
        `🚨 CRITICAL: Text too large (${text.length} chars), truncating to ${FILE_CONFIG.MAX_TEXT_LENGTH}`
      )
      text =
        text.substring(0, FILE_CONFIG.MAX_TEXT_LENGTH) +
        '\n\n[... текст обрезан для стабильной работы системы ...]'
    }

    const chunks: TextChunk[] = []

    if (preserveStructure) {
      return this.splitWithStructurePreservation(text, chunkSize, chunkOverlap)
    } else {
      return this.splitByTokens(text, chunkSize, chunkOverlap)
    }
  }

  /**
   * Разбивка с сохранением структуры (предложения, абзацы)
   */
  private static splitWithStructurePreservation(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): TextChunk[] {
    const chunks: TextChunk[] = []

    // Сначала разбиваем на абзацы
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

    let currentChunk = ''
    let currentTokens = 0
    let start = 0
    let index = 0

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.countTokens(paragraph)

      // Если абзац слишком большой, разбиваем его на предложения
      if (paragraphTokens > chunkSize) {
        // Сохраняем текущий чанк если есть
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index,
            start,
            end: start + currentChunk.length,
            tokenCount: currentTokens,
          })
          index++
        }

        // Разбиваем большой абзац
        const sentenceChunks = this.splitLargeParagraph(
          paragraph,
          chunkSize,
          chunkOverlap
        )
        sentenceChunks.forEach((chunk) => {
          chunks.push({
            ...chunk,
            index: index++,
            start: start + chunk.start,
            end: start + chunk.end,
          })
        })

        start += paragraph.length + 2 // +2 для \n\n
        currentChunk = ''
        currentTokens = 0
        continue
      }

      // Проверяем, поместится ли абзац в текущий чанк
      if (currentTokens + paragraphTokens <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        currentTokens += paragraphTokens
      } else {
        // Сохраняем текущий чанк
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index,
            start,
            end: start + currentChunk.length,
            tokenCount: currentTokens,
          })
          index++
        }

        // Начинаем новый чанк
        currentChunk = paragraph
        currentTokens = paragraphTokens
        start += currentChunk.length + 2
      }
    }

    // Добавляем последний чанк
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        start,
        end: start + currentChunk.length,
        tokenCount: currentTokens,
      })
    }

    console.log(
      `📝 OptimizedTextSplitter created ${
        chunks.length
      } chunks with average ${Math.round(
        chunks.reduce((sum, c) => sum + (c.tokenCount || 0), 0) / chunks.length
      )} tokens per chunk`
    )

    return chunks
  }

  /**
   * Разбивка большого абзаца на предложения
   */
  private static splitLargeParagraph(
    paragraph: string,
    chunkSize: number,
    chunkOverlap: number
  ): TextChunk[] {
    const chunks: TextChunk[] = []
    const sentences = paragraph
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0)

    let currentChunk = ''
    let currentTokens = 0
    let start = 0
    let index = 0

    for (const sentence of sentences) {
      const sentenceWithPunct = sentence.trim() + '.'
      const sentenceTokens = this.countTokens(sentenceWithPunct)

      if (currentTokens + sentenceTokens <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunct
        currentTokens += sentenceTokens
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index,
            start,
            end: start + currentChunk.length,
            tokenCount: currentTokens,
          })
          index++
        }

        currentChunk = sentenceWithPunct
        currentTokens = sentenceTokens
        start += currentChunk.length
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        start,
        end: start + currentChunk.length,
        tokenCount: currentTokens,
      })
    }

    return chunks
  }

  /**
   * Простая разбивка по токенам без сохранения структуры
   */
  private static splitByTokens(
    text: string,
    chunkSize: number,
    chunkOverlap: number
  ): TextChunk[] {
    const chunks: TextChunk[] = []
    const words = text.split(/\s+/)

    let currentChunk = ''
    let currentTokens = 0
    let start = 0
    let index = 0

    for (const word of words) {
      const wordTokens = this.countTokens(word + ' ')

      if (currentTokens + wordTokens <= chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + word
        currentTokens += wordTokens
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index,
            start,
            end: start + currentChunk.length,
            tokenCount: currentTokens,
          })
          index++
        }

        currentChunk = word
        currentTokens = wordTokens
        start += currentChunk.length + 1
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        start,
        end: start + currentChunk.length,
        tokenCount: currentTokens,
      })
    }

    return chunks
  }

  /**
   * Очистка ресурсов (заглушка для совместимости)
   */
  static cleanup() {
    // Нет ресурсов для очистки в fallback версии
  }
}
