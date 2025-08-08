#!/usr/bin/env tsx
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFProcessor } from '../src/lib/document-processors-clean'

async function testPDFParsing() {
  const testFiles = [
    'uploads/original/2025-08-08_18-43/Схема_добавок_для_эрадикации_хеликобактер.pdf',
    'uploads/original/2025-08-08_18-43/Чек-лист_«Сон_без_пробуждений».pdf',
    'uploads/original/2025-08-08_18-43/Схема_при_атрофическом_гастрите.pdf',
  ]

  const processor = new PDFProcessor()

  for (const file of testFiles) {
    console.log('\n' + '='.repeat(80))
    console.log(`📄 Testing: ${path.basename(file)}`)
    console.log('='.repeat(80))

    try {
      const filePath = path.join(process.cwd(), file)
      const buffer = await readFile(filePath)
      console.log(`📦 File size: ${(buffer.length / 1024).toFixed(2)} KB`)

      // Проверяем, что это PDF
      if (!processor.validateFile(buffer)) {
        console.error('❌ Not a valid PDF file')
        continue
      }

      console.log('✅ Valid PDF signature detected')
      console.log('🔄 Extracting text...')

      const startTime = Date.now()
      const text = await processor.extractText(filePath, buffer)
      const elapsed = Date.now() - startTime

      console.log(`✅ Success! Extracted in ${elapsed}ms`)
      console.log(`📊 Text length: ${text.length} characters`)
      console.log(`📊 Lines: ${text.split('\n').length}`)
      console.log(`📊 Words: ${text.split(/\s+/).length}`)

      // Показываем первые 500 символов
      console.log('\n📝 Preview (first 500 chars):')
      console.log('-'.repeat(40))
      console.log(text.substring(0, 500))
      console.log('-'.repeat(40))

      // Показываем последние 300 символов
      console.log('\n📝 End preview (last 300 chars):')
      console.log('-'.repeat(40))
      console.log(text.substring(text.length - 300))
      console.log('-'.repeat(40))
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }
}

// Запускаем тест
testPDFParsing().catch(console.error)
