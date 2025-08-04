#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'

async function testDOCFiles() {
  console.log('🧪 Тестирование DOC файлов')
  console.log('================================')
  console.log(
    '⚠️  DOC формат временно отключен из-за проблем совместимости с Next.js'
  )
  console.log('📝 Рекомендуется конвертировать DOC файлы в DOCX формат')
  console.log()

  const testDataDir = path.join(process.cwd(), 'test-data', 'doc')

  try {
    // Проверяем существование директории
    await fs.access(testDataDir)
  } catch {
    console.log('❌ Директория test-data/doc не найдена')
    console.log('📁 Создайте директорию и добавьте тестовые DOC файлы')
    return
  }

  // Получаем список файлов
  const files = await fs.readdir(testDataDir)
  const docFiles = files.filter((file) => file.toLowerCase().endsWith('.doc'))

  if (docFiles.length === 0) {
    console.log('❌ DOC файлы не найдены в test-data/doc/')
    console.log('📁 Добавьте тестовые DOC файлы в эту директорию')
    return
  }

  console.log(`📁 Найдено ${docFiles.length} DOC файлов:`)
  docFiles.forEach((file) => console.log(`  - ${file}`))
  console.log()

  // Показываем информацию о файлах
  for (const fileName of docFiles) {
    const filePath = path.join(testDataDir, fileName)
    console.log(`📤 Файл: ${fileName}`)

    try {
      // Читаем файл
      const buffer = await fs.readFile(filePath)
      console.log(`  📊 Размер файла: ${buffer.length} байт`)

      // Валидируем DOC файл
      const signature = buffer.subarray(0, 8).toString('hex')
      const isValid = signature === 'd0cf11e0a1b11ae1'
      console.log(`  ✅ Валидация: ${isValid ? 'ПРОЙДЕНА' : 'ПРОВАЛЕНА'}`)

      if (isValid) {
        console.log(`  ℹ️  Файл корректный, но обработка временно отключена`)
        console.log(`  💡 Рекомендация: конвертируйте в DOCX формат`)
      } else {
        console.log(`  ❌ Файл не является корректным DOC файлом`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.log(`  ❌ Ошибка чтения файла: ${errorMessage}`)
    }

    console.log()
  }

  // Показываем статистику поддерживаемых форматов
  console.log('📊 Поддерживаемые форматы:')
  console.log('  ✅ Работают: .pdf, .txt, .docx, .fb2, .epub')
  console.log('  ⚠️  Временно отключен: .doc (проблемы с Next.js)')
  console.log()
  console.log('🔧 Альтернативы для DOC файлов:')
  console.log('  1. Конвертируйте DOC в DOCX через Microsoft Word')
  console.log('  2. Используйте онлайн конвертеры')
  console.log('  3. Используйте LibreOffice для конвертации')
}

// Запускаем тест
testDOCFiles().catch(console.error)
