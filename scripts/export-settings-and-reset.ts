import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

const root = process.cwd()
const envLocalPath = path.join(root, '.env.local')
const envPath = path.join(root, '.env')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

async function exportSystemSettings() {
  const { getDatabase } = await import('@/lib/database')
  const db = await getDatabase()

  const rows = db
    .prepare(
      `
      SELECT * FROM system_settings
      ORDER BY category, ui_order, parameter_name
    `
    )
    .all() as any[]

  const grouped: Record<string, any[]> = {}
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category].push({
      id: row.id,
      parameter_name: row.parameter_name,
      parameter_value: row.parameter_value,
      default_value: row.default_value,
      parameter_type: row.parameter_type,
      display_name: row.display_name,
      description: row.description,
      help_text: row.help_text,
      ui_component: row.ui_component,
      ui_options: row.ui_options,
      ui_order: row.ui_order,
      requires_restart: !!row.requires_restart,
      is_sensitive: !!row.is_sensitive,
      is_readonly: !!row.is_readonly,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    })
  }

  const outDir = path.join(root, 'src', 'defaults')
  const outFile = path.join(outDir, 'settings.json')
  await fsp.mkdir(outDir, { recursive: true })
  await fsp.writeFile(outFile, JSON.stringify(grouped, null, 2), 'utf-8')
  console.log(`✅ Exported system settings to ${outFile}`)
}

async function resetSqliteTables() {
  const { getDatabase } = await import('@/lib/database')
  const db = await getDatabase()
  console.log('🧹 Cleaning SQLite tables (files, chunks, logs)...')
  db.exec(`
    DELETE FROM file_chunks;
    DELETE FROM processed_files;
    DELETE FROM files;
    DELETE FROM uploads_log;
    DELETE FROM chunks;
  `)
  console.log('✅ SQLite tables cleaned')
}

async function dropQdrantCollection() {
  try {
    const { deleteCollection } = await import('@/lib/qdrant')
    console.log('🧨 Deleting Qdrant collection...')
    await deleteCollection()
    console.log('✅ Qdrant collection deleted')
  } catch (e) {
    console.log(
      'ℹ️ Qdrant delete skipped or failed (check QDRANT_URL and connectivity).'
    )
  }
}

async function main() {
  await exportSystemSettings()
  await resetSqliteTables()
  await dropQdrantCollection()
  try {
    const uploadsPath = path.join(root, 'uploads')
    console.log(`🗑️  Removing uploads directory: ${uploadsPath}`)
    await fsp.rm(uploadsPath, { recursive: true, force: true })
    console.log('✅ uploads directory removed')
  } catch (e) {
    console.log('ℹ️  Skipped removing uploads directory')
  }
  console.log(
    '🎉 Done. You can now re-upload files; settings are backed up to src/defaults/settings.json'
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
