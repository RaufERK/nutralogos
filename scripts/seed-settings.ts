import { getDatabase, closeDatabase } from '@/lib/database'
import fs from 'fs'
import path from 'path'

type SettingItem = {
  parameter_name: string
  parameter_value: string
  default_value: string
  parameter_type: 'string' | 'number' | 'boolean' | 'json'
  display_name: string
  description?: string | null
  help_text?: string | null
  ui_component: 'input' | 'select' | 'slider' | 'toggle' | 'textarea'
  ui_options?: string | null
  ui_order?: number
  requires_restart?: boolean
  is_sensitive?: boolean
  is_readonly?: boolean
}

type SettingsJson = Record<string, SettingItem[]>

async function seedSettings() {
  const settingsPath = path.join(process.cwd(), 'src', 'defaults', 'settings.json')
  if (!fs.existsSync(settingsPath)) {
    console.error(`Settings file not found: ${settingsPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(settingsPath, 'utf-8')
  const parsed: SettingsJson = JSON.parse(raw)

  const db = await getDatabase()

  const stmt = db.prepare(`
    INSERT INTO system_settings (
      category, parameter_name, parameter_value, default_value,
      parameter_type, display_name, description, help_text,
      ui_component, ui_options, ui_order,
      requires_restart, is_sensitive, is_readonly,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(category, parameter_name) DO UPDATE SET
      parameter_value = excluded.parameter_value,
      default_value = excluded.default_value,
      parameter_type = excluded.parameter_type,
      display_name = excluded.display_name,
      description = excluded.description,
      help_text = excluded.help_text,
      ui_component = excluded.ui_component,
      ui_options = excluded.ui_options,
      ui_order = excluded.ui_order,
      requires_restart = excluded.requires_restart,
      is_sensitive = excluded.is_sensitive,
      is_readonly = excluded.is_readonly,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `)

  let total = 0
  for (const [category, items] of Object.entries(parsed)) {
    for (const item of items) {
      const uiOrder = item.ui_order ?? 0
      const requiresRestart = item.requires_restart ?? false
      const isSensitive = item.is_sensitive ?? false
      const isReadonly = item.is_readonly ?? false

      stmt.run(
        category,
        item.parameter_name,
        String(item.parameter_value),
        String(item.default_value),
        item.parameter_type,
        item.display_name,
        item.description ?? null,
        item.help_text ?? null,
        item.ui_component,
        item.ui_options ?? null,
        uiOrder,
        requiresRestart ? 1 : 0,
        isSensitive ? 1 : 0,
        isReadonly ? 1 : 0,
        'seed-settings'
      )
      total += 1
    }
  }

  console.log(`✅ Seeded/updated ${total} settings from src/defaults/settings.json`)
}

seedSettings()
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Seeding failed:', msg)
    process.exit(1)
  })
  .finally(async () => {
    await closeDatabase()
    process.exit(0)
  })


