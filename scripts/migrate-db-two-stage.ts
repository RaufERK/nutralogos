#!/usr/bin/env tsx

/**
 * Миграция базы данных для двухэтапной системы загрузки файлов
 *
 * Добавляет поля:
 * - txt_hash: хеш текстового содержимого
 * - storage_path: путь к оригинальному файлу
 * - txt_path: путь к обработанному txt файлу
 * - meta_path: путь к метаданным JSON
 * - embedded_at: дата создания эмбеддинга
 * - обновляет status для новых значений
 */

import { getDatabase } from '../src/lib/database'
import { join } from 'path'

async function migrateDatabase() {
  console.log('🔄 Начинаем миграцию базы данных для двухэтапной системы...')

  try {
    const db = await getDatabase()

    // 1. Добавляем новые поля к processed_files
    console.log('📊 Добавляем новые поля в таблицу processed_files...')

    const alterQueries = [
      `ALTER TABLE processed_files ADD COLUMN txt_hash TEXT`,
      `ALTER TABLE processed_files ADD COLUMN storage_path TEXT`,
      `ALTER TABLE processed_files ADD COLUMN txt_path TEXT`,
      `ALTER TABLE processed_files ADD COLUMN meta_path TEXT`,
      `ALTER TABLE processed_files ADD COLUMN embedded_at DATETIME`,
      `ALTER TABLE processed_files ADD COLUMN title TEXT`,
      `ALTER TABLE processed_files ADD COLUMN author TEXT`,
      `ALTER TABLE processed_files ADD COLUMN language TEXT DEFAULT 'ru'`,
    ]

    for (const query of alterQueries) {
      try {
        db.exec(query)
        console.log(`✅ Выполнено: ${query}`)
      } catch (error) {
        if (
          error instanceof Error &&
          error.message?.includes('duplicate column name')
        ) {
          console.log(`⚠️  Поле уже существует: ${query}`)
        } else {
          throw error
        }
      }
    }

    // 2. Создаем уникальные индексы
    console.log('🔍 Создаем уникальные индексы...')

    const indexQueries = [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_files_file_hash ON processed_files(file_hash)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_files_txt_hash ON processed_files(txt_hash) WHERE txt_hash IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_processed_files_status ON processed_files(processing_status)`,
      `CREATE INDEX IF NOT EXISTS idx_processed_files_embedded_at ON processed_files(embedded_at)`,
    ]

    for (const query of indexQueries) {
      try {
        db.exec(query)
        console.log(`✅ Индекс создан: ${query}`)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.log(`⚠️  Индекс уже существует или ошибка: ${errorMessage}`)
      }
    }

    // 3. Обновляем существующие статусы
    console.log('🔄 Обновляем статусы существующих файлов...')

    const updateStatusQueries = [
      `UPDATE processed_files SET processing_status = 'original_uploaded' WHERE processing_status = 'pending'`,
      `UPDATE processed_files SET processing_status = 'embedded' WHERE processing_status = 'completed'`,
      `UPDATE processed_files SET embedded_at = processed_at WHERE processing_status = 'embedded' AND embedded_at IS NULL`,
    ]

    for (const query of updateStatusQueries) {
      const result = db.prepare(query).run()
      console.log(`✅ Обновлено ${result.changes} записей: ${query}`)
    }

    // 4. Проверяем результат миграции
    console.log('🔍 Проверяем результат миграции...')

    const tableInfo = db.prepare(`PRAGMA table_info(processed_files)`).all()
    console.log('📋 Структура таблицы processed_files:')
    tableInfo.forEach((column: any) => {
      console.log(
        `  - ${column.name}: ${column.type} ${
          column.notnull ? 'NOT NULL' : ''
        } ${column.dflt_value ? `DEFAULT ${column.dflt_value}` : ''}`
      )
    })

    const fileCount = db
      .prepare(`SELECT COUNT(*) as count FROM processed_files`)
      .get() as any
    console.log(`📊 Всего файлов в базе: ${fileCount.count}`)

    const statusCounts = db
      .prepare(
        `SELECT processing_status, COUNT(*) as count FROM processed_files GROUP BY processing_status`
      )
      .all()
    console.log('📈 Распределение по статусам:')
    statusCounts.forEach((row: any) => {
      console.log(`  - ${row.processing_status}: ${row.count}`)
    })

    console.log('✅ Миграция базы данных завершена успешно!')
  } catch (error) {
    console.error('❌ Ошибка при миграции базы данных:', error)
    throw error
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('🎉 Миграция завершена!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Ошибка миграции:', error)
      process.exit(1)
    })
}

export { migrateDatabase }
