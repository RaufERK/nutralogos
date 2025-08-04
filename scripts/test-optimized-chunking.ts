#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'
import { OptimizedTextSplitter } from '../src/lib/text-splitter-optimized'
import { TextSplitter } from '../src/lib/text-splitter'

/**
 * Тест сравнения старого и нового чанкинга
 */

async function testChunkingComparison() {
  try {
    console.log('🧪 Testing chunking optimization...\n')

    // Тестируем на разных файлах
    const testFiles = [
      'test-data/txt/sample.txt',
      'test-data/doc/test_file_doc.doc',
    ]

    for (const testFile of testFiles) {
      try {
        console.log(`📄 Testing file: ${testFile}`)

        let text: string

        if (testFile.endsWith('.txt')) {
          text = await fs.readFile(path.join(process.cwd(), testFile), 'utf-8')
        } else {
          // Для DOC файлов используем процессор
          const { documentProcessorFactory } = await import(
            '../src/lib/document-processors-clean'
          )
          const processor = documentProcessorFactory.getProcessor(testFile)
          if (!processor) {
            console.log(`❌ No processor for ${testFile}`)
            continue
          }

          const buffer = await fs.readFile(path.join(process.cwd(), testFile))
          text = await processor.extractText('', buffer)
        }

        console.log(`📊 Original text: ${text.length} characters`)

        // Старый метод
        console.log('\n🔸 OLD CHUNKING METHOD:')
        const startOld = Date.now()
        const oldChunks = TextSplitter.splitText(text)
        const timeOld = Date.now() - startOld

        console.log(`  - Chunks: ${oldChunks.length}`)
        console.log(
          `  - Average size: ${Math.round(
            oldChunks.reduce((sum, c) => sum + c.content.length, 0) /
              oldChunks.length
          )} chars`
        )
        console.log(`  - Processing time: ${timeOld}ms`)

        // Новый метод
        console.log('\n🔹 NEW OPTIMIZED METHOD:')
        const startNew = Date.now()
        const newChunks = OptimizedTextSplitter.splitTextOptimized(text, {
          chunkSize: 1000, // токенов
          chunkOverlap: 200, // токенов
          preserveStructure: true,
        })
        const timeNew = Date.now() - startNew

        console.log(`  - Chunks: ${newChunks.length}`)
        console.log(
          `  - Average size: ${Math.round(
            newChunks.reduce((sum, c) => sum + c.content.length, 0) /
              newChunks.length
          )} chars`
        )
        console.log(
          `  - Average tokens: ${Math.round(
            newChunks.reduce((sum, c) => sum + (c.tokenCount || 0), 0) /
              newChunks.length
          )}`
        )
        console.log(`  - Processing time: ${timeNew}ms`)

        // Сравнение
        console.log('\n📈 COMPARISON:')
        console.log(
          `  - Chunk reduction: ${oldChunks.length} → ${
            newChunks.length
          } (${Math.round(
            (1 - newChunks.length / oldChunks.length) * 100
          )}% fewer)`
        )
        console.log(
          `  - Speed improvement: ${timeOld}ms → ${timeNew}ms (${
            timeNew < timeOld ? 'faster' : 'slower'
          })`
        )
        console.log(
          `  - Estimated API calls reduction: ${Math.round(
            (1 - newChunks.length / oldChunks.length) * 100
          )}%`
        )

        // Показываем примеры чанков
        console.log('\n📝 SAMPLE CHUNKS:')
        console.log('OLD METHOD (first 2 chunks):')
        oldChunks.slice(0, 2).forEach((chunk, i) => {
          console.log(
            `  ${i + 1}. "${chunk.content.substring(0, 100)}..." (${
              chunk.content.length
            } chars)`
          )
        })

        console.log('\nNEW METHOD (first 2 chunks):')
        newChunks.slice(0, 2).forEach((chunk, i) => {
          console.log(
            `  ${i + 1}. "${chunk.content.substring(0, 100)}..." (${
              chunk.content.length
            } chars, ~${chunk.tokenCount} tokens)`
          )
        })

        console.log('\n' + '='.repeat(80) + '\n')
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error testing ${testFile}:`, errorMessage)
      }
    }

    // Cleanup
    OptimizedTextSplitter.cleanup()

    console.log('🎉 Chunking comparison test completed!')
    console.log('\n💡 Key benefits of optimized chunking:')
    console.log('  - Fewer chunks = fewer API calls = faster embedding')
    console.log('  - Token-based sizing = better OpenAI compatibility')
    console.log('  - Structure preservation = better context retention')
    console.log('  - Configurable via admin panel')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  testChunkingComparison()
}
