/**
 * Скрипт миграции базы данных для добавления новых полей в processed_files
 * Выполняет обновление существующей базы данных к новой схеме
 */

import Database from 'better-sqlite3'
import { join } from 'path'

async function migrateDatabaseSchema() {
  console.log('🔄 Starting database schema migration...')

  try {
    // Подключаемся к базе напрямую без инициализации схемы
    const dbPath = join(process.cwd(), 'data', 'rag-chat.db')
    const db = new Database(dbPath)
    db.pragma('foreign_keys = ON')

    // Проверяем, какие колонки уже существуют
    const tableInfo = db
      .prepare('PRAGMA table_info(processed_files)')
      .all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: any
      pk: number
    }>

    const existingColumns = new Set(tableInfo.map((col) => col.name))
    console.log('📋 Existing columns:', Array.from(existingColumns))

    // Список новых колонок для добавления
    const newColumns = [
      { name: 'txt_hash', type: 'TEXT', defaultValue: null },
      { name: 'original_format', type: 'TEXT NOT NULL DEFAULT "unknown"' },
      { name: 'storage_path', type: 'TEXT', defaultValue: null },
      { name: 'txt_path', type: 'TEXT', defaultValue: null },
      { name: 'meta_path', type: 'TEXT', defaultValue: null },
      { name: 'text_length', type: 'INTEGER', defaultValue: null },
      { name: 'language', type: 'TEXT DEFAULT "ru"' },
      { name: 'processing_time_ms', type: 'INTEGER', defaultValue: null },
      { name: 'processed_at', type: 'DATETIME', defaultValue: null },
      { name: 'embedded_at', type: 'DATETIME', defaultValue: null },
    ]

    // Добавляем недостающие колонки
    for (const column of newColumns) {
      if (!existingColumns.has(column.name)) {
        try {
          const alterSQL = `ALTER TABLE processed_files ADD COLUMN ${column.name} ${column.type}`
          console.log(`➕ Adding column: ${column.name}`)
          db.exec(alterSQL)
        } catch (error: unknown) {
          console.warn(
            `⚠️  Warning: Could not add column ${column.name}:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      } else {
        console.log(`✅ Column ${column.name} already exists`)
      }
    }

    // Обновляем статус колонку если нужно (переименование значений)
    const statusUpdateSQL = `
      UPDATE processed_files 
      SET processing_status = 'original_uploaded' 
      WHERE processing_status IN ('pending', 'processing', 'completed')
    `
    db.exec(statusUpdateSQL)
    console.log('🔄 Updated processing_status values')

    // Заполняем original_format для существующих записей
    const updateFormatSQL = `
      UPDATE processed_files 
      SET original_format = LOWER(
        CASE 
          WHEN original_filename LIKE '%.pdf' THEN 'pdf'
          WHEN original_filename LIKE '%.doc' THEN 'doc'
          WHEN original_filename LIKE '%.docx' THEN 'docx'
          WHEN original_filename LIKE '%.txt' THEN 'txt'
          WHEN original_filename LIKE '%.md' THEN 'md'
          ELSE 'unknown'
        END
      )
      WHERE original_format IS NULL OR original_format = ''
    `
    db.exec(updateFormatSQL)
    console.log('📝 Populated original_format for existing records')

    // Создаем новые индексы если их нет
    const newIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_processed_files_txt_hash ON processed_files(txt_hash)',
      'CREATE INDEX IF NOT EXISTS idx_processed_files_format ON processed_files(original_format)',
    ]

    for (const indexSQL of newIndexes) {
      try {
        db.exec(indexSQL)
        console.log('📊 Created index successfully')
      } catch (error: unknown) {
        console.warn(
          '⚠️  Warning: Could not create index:',
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    // Проверяем финальную структуру
    const finalTableInfo = db
      .prepare('PRAGMA table_info(processed_files)')
      .all() as Array<{
      name: string
      type: string
    }>

    console.log('\n✅ Migration completed successfully!')
    console.log('📋 Final table structure:')
    finalTableInfo.forEach((col) => {
      console.log(`   - ${col.name}: ${col.type}`)
    })

    // Показываем статистику
    const stats = db
      .prepare('SELECT COUNT(*) as count FROM processed_files')
      .get() as { count: number }
    console.log(`\n📊 Total records in processed_files: ${stats.count}`)

    // Закрываем подключение
    db.close()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Запускаем миграцию если скрипт вызван напрямую
if (require.main === module) {
  migrateDatabaseSchema()
    .then(() => {
      console.log('🎉 Database migration completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error)
      process.exit(1)
    })
}

export { migrateDatabaseSchema }
