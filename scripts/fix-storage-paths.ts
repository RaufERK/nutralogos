import Database from 'better-sqlite3'
import { join } from 'path'

async function fixStoragePaths() {
  console.log('🔄 Updating storage paths for existing records...')

  const dbPath = join(process.cwd(), 'data', 'rag-chat.db')
  const db = new Database(dbPath)

  // Получаем записи без storage_path
  const records = db
    .prepare(
      "SELECT id, original_filename, uploaded_at FROM processed_files WHERE storage_path IS NULL OR storage_path = ''"
    )
    .all() as Array<{
    id: number
    original_filename: string
    uploaded_at: string
  }>

  console.log(`📋 Found ${records.length} records without storage_path`)

  for (const record of records) {
    const uploadDate = new Date(record.uploaded_at)
    const dateFolder = uploadDate.toISOString().split('T')[0] // YYYY-MM-DD
    const sanitizedFilename = record.original_filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
    const storagePath = `uploads/original/${dateFolder}/${sanitizedFilename}`

    db.prepare('UPDATE processed_files SET storage_path = ? WHERE id = ?').run(
      storagePath,
      record.id
    )
    console.log(`✅ Updated record ${record.id}: ${storagePath}`)
  }

  console.log('✅ Storage paths updated successfully!')
  db.close()
}

fixStoragePaths().catch(console.error)
