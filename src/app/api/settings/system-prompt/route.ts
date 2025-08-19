import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

/**
 * API для получения системного промпта из настроек
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
      .get('system_prompt') as { parameter_value: string } | undefined

    const systemPrompt = setting ? setting.parameter_value : ''

    return NextResponse.json({
      success: true,
      systemPrompt,
      length: systemPrompt.length,
    })
  } catch (error) {
    console.error('❌ [SYSTEM PROMPT API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to read system prompt',
    })
  }
}

export const runtime = 'nodejs'
