import Database from 'better-sqlite3'
import { join } from 'path'
import { unlink, readdir } from 'fs/promises'
import { existsSync } from 'fs'

async function cleanupDuplicateFiles() {
  console.log('🧹 Cleaning up duplicate files...')

  const dbPath = join(process.cwd(), 'data', 'rag-chat.db')
  const db = new Database(dbPath)

  try {
    // Получаем все файлы из базы данных
    const dbFiles = db
      .prepare('SELECT storage_path FROM processed_files')
      .all() as Array<{
      storage_path: string
    }>

    const dbPaths = new Set(dbFiles.map((f) => f.storage_path))
    console.log(`📋 Found ${dbPaths.size} files in database`)

    // Проверяем папки с оригинальными файлами
    const uploadsDir = join(process.cwd(), 'uploads', 'original')

    if (!existsSync(uploadsDir)) {
      console.log('📁 No uploads directory found')
      return
    }

    const dateFolders = await readdir(uploadsDir)
    let orphanedFiles = 0

    for (const dateFolder of dateFolders) {
      const folderPath = join(uploadsDir, dateFolder)
      try {
        const files = await readdir(folderPath)

        for (const file of files) {
          const relativePath = `uploads/original/${dateFolder}/${file}`

          if (!dbPaths.has(relativePath)) {
            const fullPath = join(process.cwd(), relativePath)
            console.log(`🗑️  Removing orphaned file: ${relativePath}`)
            await unlink(fullPath)
            orphanedFiles++
          }
        }
      } catch (error: unknown) {
        console.warn(
          `⚠️  Could not process folder ${dateFolder}:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    console.log(`✅ Cleanup completed. Removed ${orphanedFiles} orphaned files`)
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
  } finally {
    db.close()
  }
}

cleanupDuplicateFiles()
