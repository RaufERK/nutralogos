#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'
import { documentProcessorFactory } from '../src/lib/document-processors'

/**
 * Тест процессоров документов
 * Проверяет поддержку PDF, DOCX, TXT, DOC форматов
 */

interface TestFile {
  name: string
  path: string
  format: string
}

const TEST_FILES: TestFile[] = [
  {
    name: 'sample.txt',
    path: 'test-data/txt/sample.txt',
    format: 'TXT',
  },
  {
    name: 'призыв перед 10.03 из 5-11.docx',
    path: 'test-data/docx/призыв перед 10.03 из 5-11.docx',
    format: 'DOCX',
  },
  {
    name: 'test_file_doc.doc',
    path: 'test-data/doc/test_file_doc.doc',
    format: 'DOC',
  },
  {
    name: 'Healing_disp.pdf',
    path: 'test-data/pdf/Healing_disp.pdf',
    format: 'PDF',
  },
]

async function testProcessor(testFile: TestFile): Promise<boolean> {
  try {
    console.log(`\n📄 Testing ${testFile.format}: ${testFile.name}`)

    // Check if file exists
    const filePath = path.join(process.cwd(), testFile.path)
    const stats = await fs.stat(filePath)
    console.log(`📁 File size: ${stats.size} bytes`)

    // Get processor
    const processor = documentProcessorFactory.getProcessor(testFile.name)
    if (!processor) {
      console.log(`❌ No processor found for ${testFile.format}`)
      return false
    }

    console.log(`🔧 Using processor: ${processor.constructor.name}`)

    // Read file
    const buffer = await fs.readFile(filePath)

    // Validate file
    const isValid = processor.validateFile(buffer)
    if (!isValid) {
      console.log(`❌ File validation failed for ${testFile.name}`)
      return false
    }

    console.log(`✅ File validation passed`)

    // Extract text
    const startTime = Date.now()
    const text = await processor.extractText(filePath, buffer)
    const endTime = Date.now()

    console.log(
      `📝 Text extracted: ${text.length} characters in ${endTime - startTime}ms`
    )
    console.log(
      `📖 Preview: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`
    )

    return true
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Error testing ${testFile.name}:`, errorMessage)
    return false
  }
}

async function main() {
  console.log('🚀 Starting document processor tests...')

  // Test each file format
  let successCount = 0
  for (const testFile of TEST_FILES) {
    const success = await testProcessor(testFile)
    if (success) successCount++
  }

  console.log(
    `\n📊 Test Results: ${successCount}/${TEST_FILES.length} processors working correctly`
  )

  if (successCount === TEST_FILES.length) {
    console.log('🎉 All processors working!')
  } else {
    console.log('⚠️ Some processors failed. Check the logs above.')
  }
}

if (require.main === module) {
  main().catch(console.error)
}
