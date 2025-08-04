/**
 * Test script for Multi-Format File Upload
 * Tests the new upload API with different file formats
 */

import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'
const TEST_FILES_DIR = path.join(process.cwd(), 'test-files')

// Mock test files for different formats
const testFiles = [
  {
    name: 'test.txt',
    content: `Это тестовый текстовый файл для проверки обработки TXT формата.
    
Данный файл содержит достаточно контента для прохождения валидации минимального размера.
Здесь мы тестируем способность системы обрабатывать простые текстовые файлы.

Система должна корректно извлекать текст из файла, разделять его на чанки
и создавать эмбеддинги для последующего поиска по векторной базе данных.

Этот контент также содержит достаточно информации для создания качественных
векторных представлений, которые будут использоваться в RAG системе.

Дополнительный текст для увеличения размера файла и обеспечения
прохождения всех проверок валидации формата и размера.`,
    format: 'txt',
    mimeType: 'text/plain',
  },
  {
    name: 'test.fb2',
    content: `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>Тестовая книга FB2</book-title>
      <author>
        <first-name>Тест</first-name>
        <last-name>Автор</last-name>
      </author>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Глава 1</p></title>
      <p>Это тестовое содержание книги в формате FB2 для проверки парсинга XML структуры.</p>
      <p>FB2 формат широко используется для электронных книг на русском языке.</p>
      <p>Система должна корректно извлекать текст из XML элементов, включая заголовки и абзацы.</p>
      <p>В этом тестовом файле мы проверяем способность системы обрабатывать множественные параграфы.</p>
      <p>Каждый параграф должен быть корректно распознан и обработан системой.</p>
      <p>Текст должен быть извлечен с сохранением структуры и разделен на подходящие чанки.</p>
      <p>Дополнительный контент для обеспечения достаточного размера файла и прохождения валидации.</p>
    </section>
  </body>
</FictionBook>`,
    format: 'fb2',
    mimeType: 'application/x-fictionbook+xml',
  },
]

async function setupTestFiles() {
  console.log('📁 Setting up test files...')

  // Ensure test directory exists
  if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR)
  }

  // Create test files
  for (const testFile of testFiles) {
    const filePath = path.join(TEST_FILES_DIR, testFile.name)
    fs.writeFileSync(filePath, testFile.content, 'utf-8')
    console.log(`   ✅ Created: ${testFile.name}`)
  }
}

async function testFileUpload(fileName: string, format: string) {
  console.log(`\n📤 Testing ${format.toUpperCase()} upload: ${fileName}`)

  const filePath = path.join(TEST_FILES_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File not found: ${filePath}`)
    return false
  }

  try {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(filePath))

    console.log('   🔄 Sending upload request...')
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    const responseData = (await response.json()) as any

    console.log(`   📊 Response status: ${response.status}`)

    if (response.ok) {
      console.log('   ✅ Upload successful!')
      console.log(`      - Format: ${responseData.fileInfo?.format}`)
      console.log(`      - Processor: ${responseData.fileInfo?.processor}`)
      console.log(`      - Chunks: ${responseData.fileInfo?.chunks}`)
      console.log(`      - Vectors: ${responseData.fileInfo?.vectorsCreated}`)
      if (responseData.fileInfo?.title) {
        console.log(`      - Title: ${responseData.fileInfo.title}`)
      }
      return true
    } else {
      console.log('   ❌ Upload failed!')
      console.log(`      - Error: ${responseData.error}`)
      console.log(`      - Details: ${responseData.details}`)
      return false
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.log('   ❌ Request failed:', errorMessage)
    return false
  }
}

async function testSupportedFormats() {
  console.log('\n📋 Testing supported formats detection...')

  try {
    // Test with unsupported format
    const unsupportedFile = path.join(TEST_FILES_DIR, 'test.xyz')
    fs.writeFileSync(unsupportedFile, 'This is an unsupported format')

    const formData = new FormData()
    formData.append('file', fs.createReadStream(unsupportedFile))

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    const responseData = (await response.json()) as any

    if (
      response.status === 400 &&
      responseData.error?.includes('Unsupported file format')
    ) {
      console.log('   ✅ Unsupported format correctly rejected')
      console.log(
        `      - Supported formats: ${
          responseData.supportedFormats?.join(', ') || 'Not provided'
        }`
      )
    } else {
      console.log('   ❌ Unsupported format validation failed')
    }

    // Clean up
    fs.unlinkSync(unsupportedFile)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.log('   ❌ Format test failed:', errorMessage)
  }
}

async function runMultiFormatTests() {
  console.log('🧪 Multi-Format File Upload Test Suite\n')

  // Setup test files
  await setupTestFiles()

  // Test each supported format
  let successCount = 0
  let totalTests = 0

  for (const testFile of testFiles) {
    totalTests++
    const success = await testFileUpload(testFile.name, testFile.format)
    if (success) successCount++
  }

  // Test format validation
  await testSupportedFormats()

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(50))
  console.log(`✅ Successful uploads: ${successCount}/${totalTests}`)
  console.log(
    `📄 Formats tested: ${testFiles
      .map((f) => f.format.toUpperCase())
      .join(', ')}`
  )

  if (successCount === totalTests) {
    console.log('🎉 All multi-format tests passed!')
  } else {
    console.log('⚠️ Some tests failed. Check the logs above.')
  }

  // Cleanup test files
  console.log('\n🧹 Cleaning up test files...')
  try {
    fs.rmSync(TEST_FILES_DIR, { recursive: true, force: true })
    console.log('   ✅ Test files cleaned up')
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.log('   ⚠️ Cleanup failed:', errorMessage)
  }
}

// Run tests
runMultiFormatTests().catch(console.error)
