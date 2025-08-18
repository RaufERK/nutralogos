import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function POST() {
  try {
    const db = await getDatabase()

    // Load defaults from file
    const defaultsPath = join(process.cwd(), 'src', 'defaults', 'settings.json')
    const raw = await readFile(defaultsPath, 'utf8')
    const json = JSON.parse(raw) as Record<
      string,
      Array<Record<string, unknown>>
    >

    // Flatten settings: category → items
    const items: Array<{
      parameter_name: string
      default_value?: string
      parameter_value?: string
    }> = []
    for (const category of Object.keys(json)) {
      const arr = json[category]
      if (Array.isArray(arr)) {
        for (const it of arr) {
          const parameter_name = String(
            (it as { parameter_name?: unknown }).parameter_name || ''
          )
          if (!parameter_name) continue
          let default_value = String(
            (it as { default_value?: unknown }).default_value ?? ''
          )
          // Fill system_prompt from defaults/prompts/nutritial.txt if missing
          if (parameter_name === 'system_prompt' && !default_value) {
            try {
              default_value = await readFile(
                join(
                  process.cwd(),
                  'src',
                  'defaults',
                  'prompts',
                  'nutritial.txt'
                ),
                'utf8'
              )
            } catch {}
          }
          // We always reset parameter_value to default_value from file or prompt
          items.push({
            parameter_name,
            default_value,
            parameter_value: default_value,
          })
        }
      }
    }

    let updated = 0

    const tx = db.transaction(() => {
      for (const it of items) {
        const res = db
          .prepare(
            `UPDATE system_settings
             SET default_value = ?,
                 parameter_value = ?,
                 updated_at = CURRENT_TIMESTAMP,
                 updated_by = 'admin-api'
             WHERE parameter_name = ?`
          )
          .run(
            it.default_value ?? '',
            it.parameter_value ?? '',
            it.parameter_name
          )
        updated += res.changes || 0
      }
    })

    tx()

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults from settings.json',
      updated,
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
