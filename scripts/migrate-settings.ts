#!/usr/bin/env tsx

/**
 * Миграция настроек - добавляет новые системные настройки
 * Запуск: npx tsx scripts/migrate-settings.ts
 */

import { getDatabase } from '../src/lib/database'

async function migrateSettings() {
  console.log('🔧 Начинаем миграцию настроек...')

  const database = await getDatabase()

  const newSettings = [
    // System Settings
    {
      category: 'system',
      parameter_name: 'use_mock',
      parameter_value: 'false',
      default_value: 'false',
      parameter_type: 'boolean',
      display_name: 'Use Mock Mode',
      description: 'Включить мок-режим для разработки',
      help_text:
        'При включении использует фиктивные ответы вместо реальных API',
      ui_component: 'toggle',
      ui_order: 1,
      requires_restart: false,
      is_sensitive: false,
      is_readonly: false,
    },
    {
      category: 'system',
      parameter_name: 'chunk_size',
      parameter_value: '1000',
      default_value: '1000',
      parameter_type: 'number',
      display_name: 'Chunk Size',
      description: 'Размер фрагмента текста для обработки',
      help_text:
        'Количество символов в одном фрагменте при разбиении документов',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 100, max: 5000 }),
      ui_order: 2,
      requires_restart: false,
      is_sensitive: false,
      is_readonly: false,
    },
    {
      category: 'system',
      parameter_name: 'chunk_overlap',
      parameter_value: '200',
      default_value: '200',
      parameter_type: 'number',
      display_name: 'Chunk Overlap',
      description: 'Перекрытие между фрагментами текста',
      help_text: 'Количество символов перекрытия между соседними фрагментами',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 0, max: 1000 }),
      ui_order: 3,
      requires_restart: false,
      is_sensitive: false,
      is_readonly: false,
    },
    {
      category: 'system',
      parameter_name: 'system_prompt',
      parameter_value:
        'Ты — мудрый и сочувствующий духовный ассистент, специализирующийся на вопросах духовности, саморазвития и метафизики.',
      default_value:
        'Ты — мудрый и сочувствующий духовный ассистент, специализирующийся на вопросах духовности, саморазвития и метафизики.',
      parameter_type: 'string',
      display_name: 'System Prompt',
      description: 'Системный промпт для AI ассистента',
      help_text: 'Базовые инструкции которые определяют поведение AI',
      ui_component: 'textarea',
      ui_order: 4,
      requires_restart: false,
      is_sensitive: false,
      is_readonly: false,
    },
  ]

  let addedCount = 0
  let existingCount = 0

  for (const setting of newSettings) {
    try {
      // Проверяем существует ли настройка
      const existing = database
        .prepare('SELECT id FROM system_settings WHERE parameter_name = ?')
        .get(setting.parameter_name)

      if (existing) {
        console.log(`⚠️  Настройка ${setting.parameter_name} уже существует`)
        existingCount++
        continue
      }

      // Добавляем новую настройку
      const result = database
        .prepare(
          `
        INSERT INTO system_settings (
          category, parameter_name, parameter_value, default_value,
          parameter_type, display_name, description, help_text,
          ui_component, ui_options, ui_order, requires_restart,
          is_sensitive, is_readonly
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          setting.category,
          setting.parameter_name,
          setting.parameter_value,
          setting.default_value,
          setting.parameter_type,
          setting.display_name,
          setting.description,
          setting.help_text,
          setting.ui_component,
          setting.ui_options,
          setting.ui_order,
          setting.requires_restart ? 1 : 0,
          setting.is_sensitive ? 1 : 0,
          setting.is_readonly ? 1 : 0
        )

      if (result.changes > 0) {
        console.log(`✅ Добавлена настройка: ${setting.display_name}`)
        addedCount++
      }
    } catch (error) {
      console.error(
        `❌ Ошибка при добавлении ${setting.parameter_name}:`,
        error
      )
    }
  }

  console.log(`\n📊 Результаты миграции:`)
  console.log(`   • Добавлено новых настроек: ${addedCount}`)
  console.log(`   • Уже существовало: ${existingCount}`)

  if (addedCount > 0) {
    console.log(
      `\n✅ Миграция завершена! Перезапустите сервер для применения изменений.`
    )
    console.log(`\n💡 Теперь можно убрать из .env.local файла:`)
    console.log(`   • CHUNK_SIZE=1000`)
    console.log(`   • CHUNK_OVERLAP=200`)
    console.log(`   Эти параметры теперь управляются через админку.`)
  } else {
    console.log(`\n✨ Все настройки уже актуальны!`)
  }
}

// Запуск миграции
migrateSettings().catch((error) => {
  console.error('❌ Ошибка миграции:', error)
  process.exit(1)
})
