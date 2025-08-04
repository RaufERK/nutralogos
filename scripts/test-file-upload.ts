#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * Тест загрузки файлов через API
 * Проверяет поддержку PDF, DOCX, TXT форматов
 */

const API_BASE = 'http://localhost:3001'

interface TestFile {
  name: string
  path: string
  format: string
  expectedSize: number
}

const TEST_FILES: TestFile[] = [
  {
    name: 'sample.txt',
    path: 'test-data/txt/sample.txt',
    format: 'TXT',
    expectedSize: 939,
  },
  {
    name: 'призыв перед 10.03 из 5-11.docx',
    path: 'test-data/docx/призыв перед 10.03 из 5-11.docx',
    format: 'DOCX',
    expectedSize: 13450,
  },
  {
    name: 'Healing_disp.pdf',
    path: 'test-data/pdf/Healing_disp.pdf',
    format: 'PDF',
    expectedSize: 293987,
  },
]

async function testFileUpload(testFile: TestFile): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing ${testFile.format}: ${testFile.name}`)

    // Check if file exists
    const filePath = path.join(process.cwd(), testFile.path)
    const stats = await fs.stat(filePath)
    console.log(
      `📁 File size: ${stats.size} bytes (expected: ${testFile.expectedSize})`
    )

    // Read file
    const fileBuffer = await fs.readFile(filePath)

    // Create form data
    const formData = new FormData()
    formData.append('file', fileBuffer, {
      filename: testFile.name,
      contentType: getContentType(testFile.format),
    })
    formData.append('testMode', 'true')

    // Upload file
    console.log(`📤 Uploading to ${API_BASE}/api/upload...`)
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    })

    const result = (await response.json()) as any

    if (response.ok) {
      console.log(`✅ Upload successful!`)
      console.log(`📊 Result:`, {
        step: result.step,
        hasContext: result.hasContext,
        chunks: result.chunks?.length || 0,
        textLength: result.text?.length || 0,
      })
      return true
    } else {
      console.log(`❌ Upload failed:`, result)
      return false
    }
  } catch (error) {
    console.error(`❌ Error testing ${testFile.name}:`, error)
    return false
  }
}

function getContentType(format: string): string {
  switch (format) {
    case 'PDF':
      return 'application/pdf'
    case 'DOCX':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'TXT':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

async function main() {
  console.log('🚀 Starting file upload tests...')

  // Test server availability
  try {
    console.log('\n🔍 Checking server availability...')
    const healthResponse = await fetch(`${API_BASE}/api/test`)
    if (healthResponse.ok) {
      console.log('✅ Server is running')
    } else {
      console.log('⚠️ Server responded but with error status')
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Server is not available:', errorMessage)
    console.log('💡 Make sure to run: npm run dev')
    process.exit(1)
  }

  // Test each file format
  let successCount = 0
  for (const testFile of TEST_FILES) {
    const success = await testFileUpload(testFile)
    if (success) successCount++
  }

  console.log(
    `\n📊 Test Results: ${successCount}/${TEST_FILES.length} files uploaded successfully`
  )

  if (successCount === TEST_FILES.length) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('⚠️ Some tests failed. Check the logs above.')
  }
}

if (require.main === module) {
  main().catch(console.error)
}
