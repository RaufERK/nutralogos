import { NextRequest, NextResponse } from 'next/server'
import { createEnhancedRAGChain } from '@/lib/langchain/rag-chain'
import { createStreamingLLM } from '@/lib/langchain/llm'
import { Document } from '@/lib/types'
import { SettingsService } from '@/lib/settings-service'
import { ChatMessage } from '@/lib/chat-context'
import {
  createDynamicPrompt,
  formatEnhancedContextForPrompt,
} from '@/lib/langchain/prompts'
import { RAGSettings } from '@/lib/settings-service'

// Функция для отправки сообщений через WebSocket HTTP bridge
type OutboundMessage =
  | { type: 'start'; messageId: string; question: string }
  | {
      type: 'sources'
      messageId: string
      sources: Array<{
        id: string
        content: string
        metadata?: Record<string, unknown>
        score?: number
        relevanceScore?: number
      }>
    }
  | { type: 'chunk'; messageId: string; content: string }
  | { type: 'complete'; messageId: string }
  | { type: 'error'; messageId: string; error: string }

async function sendToClient(
  clientId: string,
  message: OutboundMessage
): Promise<boolean> {
  try {
    const httpPort = process.env.WEBSOCKET_HTTP_PORT || '3002'
    const baseUrl =
      process.env.WEBSOCKET_HTTP_URL || `http://localhost:${httpPort}`
    const response = await fetch(`${baseUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        message,
      }),
    })

    if (!response.ok) {
      console.error(
        '❌ HTTP bridge error:',
        response.status,
        response.statusText
      )
      return false
    }

    return true
  } catch (error) {
    console.error('❌ Failed to send WebSocket message:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      question,
      context,
      clientId,
      messageId,
    }: {
      question: string
      context?: ChatMessage[]
      clientId: string
      messageId: string
    } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required and must be a string' },
        { status: 400 }
      )
    }

    if (!clientId || !messageId) {
      return NextResponse.json(
        { error: 'ClientId and messageId are required for streaming' },
        { status: 400 }
      )
    }

    console.log('🔄 Starting streaming RAG for query:', question)
    console.log('📡 Client ID:', clientId, 'Message ID:', messageId)

    // Уведомляем клиента о начале обработки
    await sendToClient(clientId, {
      type: 'start',
      messageId,
      question,
    })

    // Проверяем настройки контекста
    const contextEnabled = await SettingsService.getSetting('context_enabled')
    const contextEnabledValue = contextEnabled?.parameter_value === 'true'

    // Формируем финальный запрос с учетом контекста
    let finalQuery = question
    let hasContextInfo = false

    if (contextEnabledValue && context && context.length > 0) {
      console.log(`📝 Используем контекст из ${context.length} сообщений`)

      const contextString = context
        .map(
          (msg) =>
            `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${
              msg.content
            }`
        )
        .join('\n')

      finalQuery = `Контекст предыдущего разговора:
${contextString}

Текущий вопрос: ${question}

Пожалуйста, ответь на текущий вопрос, учитывая контекст предыдущего разговора. Если вопрос связан с предыдущими сообщениями, используй эту информацию для более точного ответа.`

      hasContextInfo = true
    }

    // Создаем RAG chain для поиска документов
    const ragChain = createEnhancedRAGChain()

    let sources: Document[] = []
    let hasQdrantError = false

    try {
      console.log('🔍 Выполняем RAG поиск документов...')

      // RAG поиск документов

      // Выполняем поиск документов (это быстро, делаем синхронно)
      const ragResult = await ragChain.call({ query: finalQuery })

      // Преобразуем документы в наш формат
      sources = ragResult.sourceDocuments.map((doc, index) => ({
        id: String(doc.metadata?.id || `doc_${index}`),
        content: doc.content || doc.pageContent || '',
        metadata: {
          ...doc.metadata,
          score: ragResult.relevanceScores[index] || doc.score || 0,
          relevanceScore: ragResult.relevanceScores[index] || doc.score || 0,
        },
      }))

      console.log(`📊 Найдено ${sources.length} релевантных документов`)

      // Отправляем источники клиенту
      if (sources.length > 0) {
        await sendToClient(clientId, {
          type: 'sources',
          messageId,
          sources: sources.map((s) => ({
            id: String(s.id),
            content: s.content,
            metadata: s.metadata as Record<string, unknown>,
            score: s.metadata?.score,
            relevanceScore: s.metadata?.relevanceScore,
          })),
        })
      }
    } catch (chainError) {
      console.error('❌ RAG Chain error:', chainError)
      hasQdrantError = true
      console.log('🔄 Continuing with GPT-only mode for streaming...')

      // Не отправляем ошибку клиенту, просто продолжаем без RAG
      sources = []
    }

    // Создаем streaming LLM
    const streamingLLM = await createStreamingLLM()

    // Получаем промпт
    const spiritualEnabled = await RAGSettings.isSpiritualPromptEnabled()
    const prompt = await createDynamicPrompt(spiritualEnabled)

    // Формируем контекст для промпта
    const context_text =
      sources.length > 0
        ? formatEnhancedContextForPrompt(
            sources.map((s) => ({
              pageContent: s.content,
              metadata: s.metadata as unknown as Record<string, unknown>,
            }))
          )
        : 'Контекст не найден.'

    // Формируем финальный промпт
    const formattedPrompt = await prompt.format({
      context: context_text,
      question: finalQuery,
    })

    console.log('🤖 Начинаем streaming генерацию ответа...')

    try {
      // Запускаем streaming генерацию
      const stream = await streamingLLM.stream([
        {
          role: 'system',
          content: formattedPrompt,
        },
      ])

      // Обрабатываем каждый чанк
      for await (const chunk of stream as AsyncIterable<{
        content?: unknown
      }>) {
        const raw = (chunk as { content?: unknown }).content
        const content =
          typeof raw === 'string'
            ? raw
            : Array.isArray(raw)
            ? (raw as Array<unknown>)
                .map((c) =>
                  typeof c === 'string'
                    ? c
                    : typeof c === 'object' && c && 'text' in c
                    ? String((c as { text?: unknown }).text || '')
                    : ''
                )
                .join('')
            : String(raw ?? '')
        if (content) {
          // Отправляем чанк клиенту
          await sendToClient(clientId, {
            type: 'chunk',
            messageId,
            content,
          })
        }
      }

      console.log('✅ Streaming завершен, полный ответ получен')

      // Уведомляем о завершении
      await sendToClient(clientId, {
        type: 'complete',
        messageId,
      })

      // Возвращаем успешный ответ
      return NextResponse.json({
        success: true,
        messageId,
        hasContext: sources.length > 0 || hasContextInfo,
        sourcesCount: sources.length,
        qdrantStatus: hasQdrantError ? 'error' : 'ok',
      })
    } catch (streamingError) {
      console.error('❌ Streaming error:', streamingError)

      // Уведомляем клиента об ошибке
      await sendToClient(clientId, {
        type: 'error',
        messageId,
        error: 'Ошибка при генерации ответа',
      })

      return NextResponse.json(
        {
          error: 'Streaming generation failed',
          details:
            streamingError instanceof Error
              ? streamingError.message
              : 'Unknown error',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Error in /api/ask-stream:', error)

    // Enhanced error handling
    if (error instanceof Error) {
      if (
        error.message.includes('QDRANT_URL') ||
        error.message.includes('vector store')
      ) {
        return NextResponse.json(
          {
            error: 'Vector database is not configured. Please set up Qdrant.',
            details: 'Qdrant connection failed',
          },
          { status: 503 }
        )
      }

      if (error.message.includes('OPENAI_API_KEY')) {
        return NextResponse.json(
          {
            error: 'OpenAI API key is not configured.',
            details: 'OpenAI connection failed',
          },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: 'Streaming RAG pipeline failed',
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
