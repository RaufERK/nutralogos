import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

/**
 * API для получения приветственного сообщения чата из настроек
 * Публичный endpoint, не требует аутентификации
 */
export async function GET() {
  try {
    const db = await getDatabase()

    // Получаем настройку напрямую из базы данных
    const setting = db
      .prepare(
        'SELECT parameter_value FROM system_settings WHERE parameter_name = ?'
      )
      .get('chat_welcome_message') as { parameter_value: string } | undefined

    const defaultMessage = `Этот чат-помощник создан, чтобы помогать вам находить ответы на вопросы о здоровье, питании и нутрициологической поддержке.

Задайте вопрос — и я подберу для вас наиболее точную и полезную информацию из нашей экспертной базы знаний.`

    const welcomeMessage = setting ? setting.parameter_value : defaultMessage

    return NextResponse.json({
      success: true,
      welcomeMessage,
    })
  } catch (error) {
    console.error('❌ [WELCOME MESSAGE API] Error:', error)
    return NextResponse.json({
      success: true, // Возвращаем success: true с fallback значением
      welcomeMessage: `Этот чат-помощник создан, чтобы помогать вам находить ответы на вопросы о здоровье, питании и нутрициологической поддержке.

Задайте вопрос — и я подберу для вас наиболее точную и полезную информацию из нашей экспертной базы знаний.`,
      fallback: true,
    })
  }
}

export const runtime = 'nodejs'
