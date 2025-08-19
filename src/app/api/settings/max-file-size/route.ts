import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

/**
 * API для получения максимального размера файла из настроек
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
      .get('max_file_size_mb') as { parameter_value: string } | undefined

    const maxFileSizeMB = setting ? parseInt(setting.parameter_value) : 50

    return NextResponse.json({
      success: true,
      maxFileSizeMB,
      maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    })
  } catch (error) {
    console.error('❌ [MAX FILE SIZE API] Error:', error)
    return NextResponse.json({
      success: true, // Возвращаем success: true с fallback значением
      maxFileSizeMB: 50,
      maxFileSizeBytes: 50 * 1024 * 1024,
      fallback: true,
    })
  }
}

export const runtime = 'nodejs'
