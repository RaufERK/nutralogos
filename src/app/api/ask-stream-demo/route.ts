import { NextRequest, NextResponse } from 'next/server'

// Функция для отправки сообщений через WebSocket HTTP мост
type DemoOutboundMessage =
  | { type: 'start'; messageId: string; question: string }
  | {
      type: 'sources'
      messageId: string
      sources: Array<{
        id: string
        content: string
        metadata?: Record<string, unknown>
        score?: number
      }>
    }
  | { type: 'chunk'; messageId: string; content: string }
  | { type: 'complete'; messageId: string }
  | { type: 'error'; messageId: string; error: string }

async function sendToClient(
  clientId: string,
  message: DemoOutboundMessage
): Promise<boolean> {
  try {
    const httpPort = process.env.WEBSOCKET_HTTP_PORT || '3002'
    const response = await fetch(`http://localhost:${httpPort}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId, message }),
    })

    if (response.ok) {
      const result = await response.json()
      return result.success
    } else {
      console.warn('⚠️ WebSocket bridge failed:', response.status)
      return false
    }
  } catch (error) {
    console.error('❌ Failed to send WebSocket message:', error)
    return false
  }
}

// Демо-ответы для разных вопросов
const demoResponses: { [key: string]: string } = {
  'кто ты':
    'Я - ИИ-помощник по вопросам здоровья, питания и нутрициологии. Я создан для того, чтобы помогать вам находить ответы на вопросы о здоровом образе жизни.',
  'витамин d':
    'Витамин D - это жирорастворимый витамин, который играет ключевую роль в усвоении кальция и поддержании здоровья костей. Он также важен для иммунной системы и мышечной функции.',
  белок:
    'Белок - это макронутриент, состоящий из аминокислот. Он необходим для роста и восстановления тканей, производства ферментов и гормонов.',
  'что такое':
    'Это хороший вопрос! В реальном приложении я бы поискал информацию в базе знаний и дал подробный ответ на основе научных данных.',
  здоровье:
    'Здоровье - это состояние полного физического, психического и социального благополучия. Оно зависит от многих факторов: питания, физической активности, сна и эмоционального состояния.',
  питание:
    'Правильное питание - основа здоровья. Важно получать все необходимые макро- и микронутриенты, соблюдать баланс белков, жиров и углеводов.',
  default:
    'Благодарю за интересный вопрос! На основе моих знаний о нутрициологии и здоровье, могу сказать, что это важная тема. Для получения наиболее точной и персонализированной информации рекомендую обратиться к специалисту.',
}

function getResponseForQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase()

  console.log('🔍 Matching question:', lowerQuestion)

  for (const [key, response] of Object.entries(demoResponses)) {
    if (key !== 'default' && lowerQuestion.includes(key)) {
      console.log('✅ Matched key:', key)
      return response
    }
  }

  console.log('📝 Using default response')
  return demoResponses.default
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
      context?: Array<{ role: 'user' | 'assistant'; content: string }>
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

    console.log('🎭 DEMO: Starting streaming for query:', question)
    console.log('📡 Client ID:', clientId, 'Message ID:', messageId)

    // Уведомляем клиента о начале обработки
    const startSent = await sendToClient(clientId, {
      type: 'start',
      messageId,
      question,
    })
    console.log('📤 Start message sent:', startSent)

    // Получаем демо-ответ
    const fullResponse = getResponseForQuestion(question)

    // Имитируем поиск источников
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Отправляем демо-источники
    const sourcesSent = await sendToClient(clientId, {
      type: 'sources',
      messageId,
      sources: [
        {
          id: 'demo_1',
          content:
            'Это демо-источник информации из базы знаний по нутрициологии.',
          metadata: {
            category: 'Демо',
            topic: 'Стриминг',
            score: 0.95,
          },
        },
      ],
    })
    console.log('📤 Sources message sent:', sourcesSent)

    console.log('🤖 DEMO: Начинаем streaming генерацию ответа...')

    // Имитируем потоковую генерацию - отправляем ответ по частям
    const words = fullResponse.split(' ')

    for (let i = 0; i < words.length; i++) {
      const chunk = i === 0 ? words[i] : ' ' + words[i]

      // Отправляем чанк клиенту
      await sendToClient(clientId, {
        type: 'chunk',
        messageId,
        content: chunk,
      })

      // Имитируем задержку между чанками (как настоящий стриминг)
      await new Promise((resolve) =>
        setTimeout(resolve, 50 + Math.random() * 100)
      )
    }

    console.log('✅ DEMO: Streaming завершен')

    // Уведомляем о завершении
    const completeSent = await sendToClient(clientId, {
      type: 'complete',
      messageId,
    })
    console.log('📤 Complete message sent:', completeSent)

    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      messageId,
      hasContext: true,
      sourcesCount: 1,
      mode: 'demo',
    })
  } catch (error) {
    console.error('❌ DEMO: Error in /api/ask-stream-demo:', error)

    return NextResponse.json(
      {
        error: 'Demo streaming failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
