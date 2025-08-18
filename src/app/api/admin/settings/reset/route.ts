import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'

export async function POST() {
  try {
    const db = await getDatabase()

    const tx = db.transaction(() => {
      db.exec(
        `UPDATE system_settings 
         SET parameter_value = default_value, 
             updated_at = CURRENT_TIMESTAMP, 
             updated_by = 'admin-api'`
      )
    })

    tx()

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
