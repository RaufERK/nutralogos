#!/usr/bin/env tsx
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'rag.db')
const db = new Database(dbPath)

// Сбрасываем статус failed файлов на original_uploaded
const resetFailed = db.prepare(`
  UPDATE files 
  SET processing_status = 'original_uploaded'
  WHERE processing_status = 'failed'
`)

const result = resetFailed.run()
console.log(
  `✅ Reset ${result.changes} failed files to 'original_uploaded' status`
)

// Показываем текущее состояние
const stats = db
  .prepare(
    `
  SELECT 
    processing_status, 
    COUNT(*) as count 
  FROM files 
  GROUP BY processing_status
`
  )
  .all()

console.log('\n📊 Current file statuses:')
stats.forEach((stat: any) => {
  console.log(`  - ${stat.processing_status}: ${stat.count} files`)
})

db.close()

