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

    const defaultPrompt = `Ты — профессиональный ассистент нутрициолога.

Твоя задача — помогать пользователю находить обоснованные и полезные ответы по темам здоровья, питания, витаминов, микро- и макроэлементов, добавок, образа жизни и нутрицевтической поддержки.`

    const systemPrompt = setting ? setting.parameter_value : defaultPrompt

    return NextResponse.json({
      success: true,
      systemPrompt,
      length: systemPrompt.length,
    })
  } catch (error) {
    console.error('❌ [SYSTEM PROMPT API] Error:', error)
    return NextResponse.json({
      success: true, // Возвращаем success: true с fallback значением
      systemPrompt: `Ты — профессиональный ассистент нутрициолога.

Твоя задача — помогать пользователю находить обоснованные и полезные ответы по темам здоровья, питания, витаминов, микро- и макроэлементов, добавок, образа жизни и нутрицевтической поддержки.`,
      fallback: true,
    })
  }
}
