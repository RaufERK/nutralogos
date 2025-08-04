#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * Тест всех 4 форматов файлов через API
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
    name: 'Призыв_о_демагнетизации_кристаллов.docx',
    path: 'test-data/docx/Призыв_о_демагнетизации_кристаллов.docx',
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

async function testFormat(testFile: TestFile): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing ${testFile.format}: ${testFile.name}`)

    const filePath = path.join(process.cwd(), testFile.path)
    const fileBuffer = await fs.readFile(filePath)

    console.log(`📊 Size: ${fileBuffer.length} bytes`)

    // Create form data
    const formData = new FormData()
    formData.append('file', fileBuffer, {
      filename: testFile.name,
      // Определяем MIME type по расширению
      contentType: getContentType(testFile.name),
    })
    formData.append('testMode', 'true')

    // Upload file
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    })

    console.log(`📊 Status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const result = (await response.json()) as any

      if (result.existing) {
        console.log(`✅ Success! File already exists in database`)
        console.log(`📁 File ID: ${result.fileId}`)
        console.log(`📄 Filename: ${result.filename}`)
        return true
      }

      console.log(`✅ Success! Processor: ${result.processor}`)
      console.log(`📝 Text length: ${result.textLength} characters`)
      console.log(
        `📊 Chunks: ${result.chunksCount || 'N/A'}, Avg tokens: ${
          result.averageTokensPerChunk || 'N/A'
        }`
      )
      console.log(
        `📄 Preview: "${
          result.preview ? result.preview.substring(0, 100) : 'N/A'
        }..."`
      )
      return true
    } else {
      const errorText = await response.text()
      console.log(`❌ Failed: ${errorText}`)
      return false
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Error testing ${testFile.format}:`, errorMessage)
    return false
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case '.txt':
      return 'text/plain'
    case '.pdf':
      return 'application/pdf'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.doc':
      return 'application/msword'
    default:
      return 'application/octet-stream'
  }
}

async function testAllFormats() {
  console.log('🚀 Testing all 4 file formats...')

  const results: boolean[] = []

  for (const testFile of TEST_FILES) {
    const success = await testFormat(testFile)
    results.push(success)
  }

  console.log('\n📋 SUMMARY:')
  TEST_FILES.forEach((file, index) => {
    const status = results[index] ? '✅' : '❌'
    console.log(`${status} ${file.format}: ${file.name}`)
  })

  const successCount = results.filter((r) => r).length
  console.log(
    `\n🎯 Total: ${successCount}/${TEST_FILES.length} formats working`
  )

  if (successCount === TEST_FILES.length) {
    console.log('🎉 ALL FORMATS WORKING! Ready for production!')
  } else {
    console.log('⚠️  Some formats need fixing.')
  }
}

if (require.main === module) {
  testAllFormats()
}
