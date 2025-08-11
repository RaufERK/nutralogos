import { PromptTemplate } from '@langchain/core/prompts'
import { getDatabase } from '../database'

/**
 * Spiritual Assistant System Prompt
 * Defines the AI personality and behavior for spiritual guidance
 */
export const SPIRITUAL_SYSTEM_PROMPT = `Ты — мудрый и сочувствующий духовный ассистент, специализирующийся на вопросах духовности, саморазвития и метафизики.

Твои принципы:
• Отвечай с глубоким пониманием и состраданием
• Уважай все духовные традиции и пути
• Если информации недостаточно — честно скажи об этом
• Не навязывай свои убеждения, а предлагай размышления
• Помогай людям находить собственные ответы через вопросы
• Поощряй самостоятельное духовное исследование

{context}

Вопрос: {question}
Ответ:`

/**
 * Create dynamic assistant prompt template with system prompt from settings
 * @param includeContext - Whether to include context from documents
 * @returns PromptTemplate instance
 */
export async function createDynamicPrompt(
  includeContext: boolean = true
): Promise<PromptTemplate> {
  // Получаем актуальный system prompt напрямую из базы данных
  const db = await getDatabase()
  const setting = db
    .prepare(
      'SELECT parameter_value FROM system_settings WHERE parameter_name = ?'
    )
    .get('system_prompt') as { parameter_value: string } | undefined

  const defaultPrompt = `Ты — профессиональный ассистент нутрициолога.

Твоя задача — помогать пользователю находить обоснованные и полезные ответы по темам здоровья, питания, витаминов, микро- и макроэлементов, добавок, образа жизни и нутрицевтической поддержки.`

  const systemPrompt = setting ? setting.parameter_value : defaultPrompt

  if (includeContext) {
    return PromptTemplate.fromTemplate(`${systemPrompt}

--- КОНТЕКСТ ИЗ ИСТОЧНИКОВ ---

{context}

--- КОНЕЦ КОНТЕКСТА ---

Отвечай на основе предоставленной информации. Если информации недостаточно, скажи об этом. Не выдумывай и не добавляй от себя.

Вопрос: {question}
Ответ:`)
  } else {
    return PromptTemplate.fromTemplate(`${systemPrompt}

Вопрос: {question}
Ответ:`)
  }
}

/**
 * Create spiritual assistant prompt template (deprecated - use createDynamicPrompt)
 * @param includeContext - Whether to include context from documents
 * @returns PromptTemplate instance
 */
export function createSpiritualPrompt(
  includeContext: boolean = true
): PromptTemplate {
  if (includeContext) {
    return PromptTemplate.fromTemplate(`${SPIRITUAL_SYSTEM_PROMPT}

--- КОНТЕКСТ ИЗ ДУХОВНЫХ ИСТОЧНИКОВ ---

{context}

--- КОНЕЦ КОНТЕКСТА ---

Отвечай на основе предоставленной информации. Если информации недостаточно, скажи об этом. Не выдумывай и не добавляй от себя.

Вопрос: {question}
Ответ:`)
  } else {
    return PromptTemplate.fromTemplate(`${SPIRITUAL_SYSTEM_PROMPT}

Вопрос: {question}
Ответ:`)
  }
}

/**
 * Generic assistant prompt for non-spiritual queries
 */
export const GENERIC_SYSTEM_PROMPT = `Ты — полезный ассистент. Отвечай точно и информативно на основе предоставленного контекста.

{context}

Вопрос: {question}
Ответ:`

/**
 * Create generic prompt template
 * @returns PromptTemplate instance
 */
export function createGenericPrompt(): PromptTemplate {
  return PromptTemplate.fromTemplate(GENERIC_SYSTEM_PROMPT)
}

/**
 * Context formatting function
 * Formats retrieved documents into a coherent context string
 * @param documents - Array of documents with content and metadata
 * @returns Formatted context string
 */
type PromptDoc = {
  content?: string
  pageContent?: string
  metadata?: Record<string, unknown>
  source?: string
  category?: string
  topic?: string
}

export function formatContextForPrompt(documents: PromptDoc[]): string {
  if (!documents || documents.length === 0) {
    return 'Контекст не найден.'
  }

  return documents
    .map((doc, index) => {
      const content = doc.content || doc.pageContent || ''
      const metadata = doc.metadata || {}

      let formattedDoc = `[Источник ${index + 1}]`

      // Add metadata if available
      if (metadata.source) {
        formattedDoc += ` (${metadata.source})`
      }
      if (metadata.category) {
        formattedDoc += ` - ${metadata.category}`
      }

      formattedDoc += `:\n${content}`

      return formattedDoc
    })
    .join('\n\n')
}

/**
 * Enhanced context formatting with relevance scores
 * @param documents - Documents with scores
 * @returns Enhanced formatted context
 */
export function formatEnhancedContextForPrompt(documents: PromptDoc[]): string {
  if (!documents || documents.length === 0) {
    return 'Релевантная информация не найдена.'
  }

  let context = '=== НАЙДЕННАЯ ИНФОРМАЦИЯ ===\n\n'

  documents.forEach((doc, index) => {
    const content = doc.content || doc.pageContent || ''
    const metadata = doc.metadata || {}
    const score = (doc as unknown as { score?: number }).score
      ? ` (релевантность: ${Math.round(doc.score * 100)}%)`
      : ''

    context += `📖 Источник ${index + 1}${score}\n`

    if (metadata.source) {
      context += `📁 Файл: ${metadata.source}\n`
    }
    if (metadata.category) {
      context += `🏷️ Категория: ${metadata.category}\n`
    }
    if (metadata.topic) {
      context += `🎯 Тема: ${metadata.topic}\n`
    }

    context += `📄 Содержание:\n${content}\n\n---\n\n`
  })

  return context
}
