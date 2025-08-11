import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Ensure env variables are loaded when running via tsx
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

async function resetQdrant() {
  const { deleteCollection, createCollection } = await import('@/lib/qdrant')
  console.log('🧨 Resetting Qdrant collection...')
  try {
    await deleteCollection()
  } catch (e) {
    console.log('ℹ️ Qdrant delete skipped or failed (may not exist).')
  }
  await createCollection()
  // ensurePayloadIndexes is not available in current qdrant helper; skipping
  console.log('✅ Qdrant collection is ready')
}

async function resetSqlite() {
  console.log('🧨 Resetting SQLite tables...')
  const { getDatabase } = await import('@/lib/database')
  const db = await getDatabase()
  db.exec(`
    DELETE FROM file_chunks;
    DELETE FROM processed_files;
    DELETE FROM files;
    DELETE FROM uploads_log;
    DELETE FROM chunks;
  `)
  console.log('✅ SQLite tables cleaned')
}

async function main() {
  await resetQdrant()
  await resetSqlite()
  console.log('🎉 Stores reset complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
