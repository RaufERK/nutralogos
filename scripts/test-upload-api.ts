import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

// Load environment variables
dotenv.config()

interface TestConfig {
  mode: 'normal' | 'test' | 'reset'
  baseUrl: string
  testDataPath: string
}

interface TestResult {
  fileName: string
  format: string
  success: boolean
  error?: string
  response?: any
}

class TestUploadAPI {
  private config: TestConfig

  constructor(config: TestConfig) {
    this.config = config
  }

  async runTests(): Promise<TestResult[]> {
    console.log(`🧪 Starting file upload tests...`)
    console.log(`📁 Test data path: ${this.config.testDataPath}`)
    console.log(`🔧 Test mode: ${this.config.mode}`)

    // Get all test files
    const testFiles = await this.getTestFiles()
    console.log(`📄 Found ${testFiles.length} test files`)

    const results: TestResult[] = []

    for (const filePath of testFiles) {
      const fileName = path.basename(filePath)
      console.log(`\n📤 Testing: ${fileName}`)

      try {
        const result = await this.uploadFile(filePath, fileName)
        results.push(result)

        if (result.success) {
          console.log(`✅ ${fileName}: SUCCESS (${result.format})`)
        } else {
          console.log(`❌ ${fileName}: FAILED - ${result.error}`)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.log(`💥 ${fileName}: ERROR - ${errorMessage}`)
        results.push({
          fileName,
          format: 'unknown',
          success: false,
          error: error.message,
        })
      }

      // Small delay between uploads
      await this.delay(1000)
    }

    return results
  }

  private async getTestFiles(): Promise<string[]> {
    const files: string[] = []

    try {
      await this.scanDirectory(this.config.testDataPath, files)
    } catch (error) {
      console.error(`❌ Error reading test data directory: ${error.message}`)
    }

    return files.sort()
  }

  private async scanDirectory(dirPath: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          // Skip .DS_Store and other system directories
          if (!entry.name.startsWith('.')) {
            await this.scanDirectory(fullPath, files)
          }
        } else if (entry.isFile()) {
          // Skip system files and large files for initial testing
          if (
            !entry.name.startsWith('.') &&
            entry.name !== '.DS_Store' &&
            entry.name !== 'FILE_INDEX.md' &&
            !entry.name.includes('Внедрение режима_КУРС.pptx') && // Skip 16MB file
            !entry.name.includes('l_Познай себя.txt')
          ) {
            // Skip 227KB file
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning directory ${dirPath}: ${error.message}`)
    }
  }

  private async uploadFile(
    filePath: string,
    fileName: string
  ): Promise<TestResult> {
    try {
      // Read file
      const fileBuffer = await fs.readFile(filePath)

      // Create FormData
      const formData = new FormData()
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: this.getMimeType(fileName),
      })

      // Add test mode parameter
      if (this.config.mode !== 'normal') {
        formData.append('testMode', this.config.mode)
      }

      // Upload file
      const response = await fetch(`${this.config.baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          ...formData.getHeaders(),
        },
      })

      const responseData = await response.json()

      if (response.ok) {
        return {
          fileName,
          format: responseData.fileInfo?.format || 'unknown',
          success: true,
          response: responseData,
        }
      } else {
        return {
          fileName,
          format: 'unknown',
          success: false,
          error: responseData.error || `HTTP ${response.status}`,
        }
      }
    } catch (error) {
      return {
        fileName,
        format: 'unknown',
        success: false,
        error: error.message,
      }
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.epub': 'application/epub+zip',
      '.fb2': 'application/x-fictionbook+xml',
      '.pptx':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  printSummary(results: TestResult[]): void {
    console.log('\n📊 TEST SUMMARY')
    console.log('=' * 50)

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    console.log(`✅ Successful: ${successful.length}/${results.length}`)
    console.log(`❌ Failed: ${failed.length}/${results.length}`)

    if (successful.length > 0) {
      console.log('\n✅ SUCCESSFUL UPLOADS:')
      successful.forEach((r) => {
        console.log(`  - ${r.fileName} (${r.format})`)
      })
    }

    if (failed.length > 0) {
      console.log('\n❌ FAILED UPLOADS:')
      failed.forEach((r) => {
        console.log(`  - ${r.fileName}: ${r.error}`)
      })
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || 'normal' // normal, test, reset

  if (!['normal', 'test', 'reset'].includes(mode)) {
    console.error('❌ Invalid mode. Use: normal, test, or reset')
    process.exit(1)
  }

  const config: TestConfig = {
    mode: mode as 'normal' | 'test' | 'reset',
    baseUrl: 'http://localhost:3000',
    testDataPath: './test-data',
  }

  const tester = new TestUploadAPI(config)

  try {
    const results = await tester.runTests()
    tester.printSummary(results)

    // Exit with error code if any tests failed
    const failedCount = results.filter((r) => !r.success).length
    if (failedCount > 0) {
      console.log(`\n⚠️  ${failedCount} tests failed`)
      process.exit(1)
    } else {
      console.log('\n🎉 All tests passed!')
    }
  } catch (error) {
    console.error('💥 Test execution failed:', error)
    process.exit(1)
  }
}

main()
