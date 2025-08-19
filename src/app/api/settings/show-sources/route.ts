import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await getDatabase()
    const row = db
      .prepare(
        'SELECT parameter_value FROM system_settings WHERE parameter_name = ?'
      )
      .get('ui_show_sources') as { parameter_value?: string } | undefined

    const show = row?.parameter_value === 'true'
    return NextResponse.json({ success: true, showSources: show })
  } catch (error) {
    return NextResponse.json({
      success: true,
      showSources: false,
      fallback: true,
    })
  }
}

export const runtime = 'nodejs'
