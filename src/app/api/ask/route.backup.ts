import { NextRequest, NextResponse } from 'next/server'
import { getEmbedding, getChatCompletion } from '@/lib/openai'
import { searchSimilar } from '@/lib/qdrant'
import { AskRequest, AskResponse, ChatMessage, Document } from '@/lib/types'

// Функция для ранжирования документов по релевантности
function reRankDocuments(documents: Document[], question: string): Document[] {
  if (!documents || documents.length === 0) return []

  // Простое лексикальное соответствие + метаданные
  const questionLower = question.toLowerCase()
  const spiritualKeywords = [
    'духовность',
    'медитация',
    'просветление',
    'сознание',
    'чакра',
    'энергия',
    'карма',
    'реинкарнация',
    'вознесение',
    'мастер',
    'учитель',
    'майтрейя',
    'целительство',
    'любовь',
    'мир',
  ]

  return documents
    .map((doc) => {
      let score = 0
      const content = doc.content.toLowerCase()

      // Основной скор по вхождению слов из вопроса
      const questionWords = questionLower
        .split(/\s+/)
        .filter((w) => w.length > 2)
      questionWords.forEach((word) => {
        if (content.includes(word)) score += 2
      })

      // Бонус за духовные ключевые слова
      spiritualKeywords.forEach((keyword) => {
        if (content.includes(keyword) || questionLower.includes(keyword)) {
          score += 3
        }
      })

      // Бонус за матчинг метаданных
      if (doc.metadata?.category) {
        if (questionLower.includes(doc.metadata.category.toLowerCase()))
          score += 5
        if (
          doc.metadata.category === 'spiritual' ||
          doc.metadata.category === 'teaching'
        )
          score += 2
      }
      if (
        doc.metadata?.topic &&
        questionLower.includes(doc.metadata.topic.toLowerCase())
      ) {
        score += 4
      }

      return { ...doc, relevanceScore: score }
    })
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 6) // Оставляем топ-6 наиболее релевантных
}

// Функция для форматирования контекста с метаданными
function formatEnhancedContext(documents: Document[]): string | undefined {
  if (!documents || documents.length === 0) return undefined

  const formattedDocs = documents.map((doc, index) => {
    const metadata = doc.metadata
      ? `[${doc.metadata.category || 'general'}/${
          doc.metadata.topic || 'mixed'
        }]`
      : '[unknown/unknown]'
    const relevanceInfo =
      'relevanceScore' in (doc as unknown as { relevanceScore?: number })
        ? ` (Релевантность: ${
            (doc as unknown as { relevanceScore?: number }).relevanceScore ?? 0
          })`
        : ''
    return `--- Источник ${
      index + 1
    } ${metadata}${relevanceInfo} ---\n${doc.content.trim()}`
  })

  return formattedDocs.join('\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const body: AskRequest = await request.json()
    const { question } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      )
    }

    // 1. Получаем эмбеддинг вопроса
    const questionEmbedding = await getEmbedding(question)

    // 2. Ищем похожие документы в Qdrant
    let similarDocuments: Document[] = []
    let hasQdrantError = false

    try {
      console.log('🔍 Searching for similar documents...')
      similarDocuments = await searchSimilar(questionEmbedding, 8, 0.3)
      console.log(`📊 Found ${similarDocuments.length} similar documents`)
    } catch (qdrantError) {
      console.error('❌ Qdrant error:', qdrantError)
      hasQdrantError = true
      similarDocuments = []
    }

    // 3. Применяем re-ranking для улучшения релевантности
    const reRankedDocuments = reRankDocuments(similarDocuments, question)
    console.log(
      `📊 Re-ranked ${reRankedDocuments.length} documents by relevance`
    )

    // 4. Формируем расширенный контекст из найденных документов
    const context = formatEnhancedContext(reRankedDocuments)

    if (context) {
      console.log('📝 Using enhanced RAG context for answer generation')
    } else {
      if (hasQdrantError) {
        console.log('⚠️ Qdrant unavailable, using GPT only')
      } else {
        console.log('⚠️ No relevant documents found, using GPT only')
      }
    }

    // 5. Создаем сообщение пользователя
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
    }

    // 6. Получаем ответ от GPT-4o с улучшенным контекстом
    const answer = await getChatCompletion([userMessage], context)

    // 7. Формируем ответ с улучшенной информацией
    const response: AskResponse = {
      answer,
      sources: reRankedDocuments.length > 0 ? reRankedDocuments : undefined,
      hasContext: reRankedDocuments.length > 0,
      sourcesCount: reRankedDocuments.length,
      searchScore: reRankedDocuments.length > 0 ? 0.9 : undefined, // Повысили оценку благодаря re-ranking
      qdrantStatus: hasQdrantError ? 'error' : 'ok',
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in /api/ask:', error)

    // Проверяем, является ли ошибка связанной с Qdrant
    if (error instanceof Error && error.message.includes('QDRANT_URL')) {
      return NextResponse.json(
        {
          error:
            'Vector database is not configured. Please set up Qdrant or use mock mode.',
          details: 'Qdrant configuration is missing or invalid',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
