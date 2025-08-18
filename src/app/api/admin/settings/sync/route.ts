import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function POST() {
  try {
    const db = await getDatabase()

    const defaultsPath = join(process.cwd(), 'src', 'defaults', 'settings.json')
    const raw = await readFile(defaultsPath, 'utf8')
    const json = JSON.parse(raw) as Record<
      string,
      Array<Record<string, unknown>>
    >

    const desired: Array<{
      category: string
      parameter_name: string
      parameter_value?: string
      default_value?: string
      parameter_type?: string
      display_name?: string
      description?: string
      help_text?: string
      ui_component?: string
      ui_options?: string | null
      ui_order?: number
      requires_restart?: number
      is_sensitive?: number
      is_readonly?: number
    }> = []

    for (const [category, arr] of Object.entries(json)) {
      if (!Array.isArray(arr)) continue
      for (const it of arr as Array<{
        parameter_name?: unknown
        parameter_value?: unknown
        default_value?: unknown
        parameter_type?: unknown
        display_name?: unknown
        description?: unknown
        help_text?: unknown
        ui_component?: unknown
        ui_options?: unknown
        ui_order?: unknown
        requires_restart?: unknown
        is_sensitive?: unknown
        is_readonly?: unknown
      }>) {
        desired.push({
          category,
          parameter_name: String(it.parameter_name),
          parameter_value: String(it.parameter_value ?? ''),
          default_value: String(it.default_value ?? ''),
          parameter_type: String(it.parameter_type ?? 'string'),
          display_name: String(it.display_name ?? ''),
          description: String(it.description ?? ''),
          help_text: String(it.help_text ?? ''),
          ui_component: String(it.ui_component ?? 'input'),
          ui_options: (it.ui_options as string | null | undefined) ?? null,
          ui_order: Number(it.ui_order ?? 0),
          requires_restart: it.requires_restart ? 1 : 0,
          is_sensitive: it.is_sensitive ? 1 : 0,
          is_readonly: it.is_readonly ? 1 : 0,
        })
      }
    }

    const desiredNames = new Set(desired.map((d) => d.parameter_name))

    const tx = db.transaction(() => {
      // Delete extra settings not in defaults
      db.prepare(
        `DELETE FROM system_settings WHERE parameter_name NOT IN (${Array.from(
          desiredNames
        )
          .map(() => '?')
          .join(',')})`
      ).run(...Array.from(desiredNames))

      // Upsert all desired settings
      for (const d of desired) {
        const exists = db
          .prepare(
            'SELECT COUNT(*) as count FROM system_settings WHERE parameter_name = ?'
          )
          .get(d.parameter_name) as { count: number }

        if (exists.count > 0) {
          db.prepare(
            `UPDATE system_settings SET
              category = ?, parameter_value = ?, default_value = ?, parameter_type = ?,
              display_name = ?, description = ?, help_text = ?, ui_component = ?, ui_options = ?,
              ui_order = ?, requires_restart = ?, is_sensitive = ?, is_readonly = ?,
              updated_at = CURRENT_TIMESTAMP, updated_by = 'admin-api'
             WHERE parameter_name = ?`
          ).run(
            d.category,
            d.parameter_value ?? '',
            d.default_value ?? '',
            d.parameter_type ?? 'string',
            d.display_name ?? '',
            d.description ?? '',
            d.help_text ?? '',
            d.ui_component ?? 'input',
            d.ui_options,
            d.ui_order ?? 0,
            d.requires_restart ?? 0,
            d.is_sensitive ?? 0,
            d.is_readonly ?? 0,
            d.parameter_name
          )
        } else {
          db.prepare(
            `INSERT INTO system_settings (
              category, parameter_name, parameter_value, default_value, parameter_type,
              display_name, description, help_text, ui_component, ui_options, ui_order,
              requires_restart, is_sensitive, is_readonly, created_at, updated_at, updated_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'admin-api')`
          ).run(
            d.category,
            d.parameter_name,
            d.parameter_value ?? '',
            d.default_value ?? '',
            d.parameter_type ?? 'string',
            d.display_name ?? '',
            d.description ?? '',
            d.help_text ?? '',
            d.ui_component ?? 'input',
            d.ui_options,
            d.ui_order ?? 0,
            d.requires_restart ?? 0,
            d.is_sensitive ?? 0,
            d.is_readonly ?? 0
          )
        }
      }
    })

    tx()

    return NextResponse.json({ success: true, updated: desired.length })
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
