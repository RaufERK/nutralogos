import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { documentProcessorFactory } from '@/lib/document-processors-clean'
import {
  calculateTextHash,
  generateTxtFilePaths,
  checkTxtHashExists,
} from '@/lib/file-hash-utils'
import { getDatabase } from '@/lib/database'
import { addDocuments } from '@/lib/langchain/vectorstore'
import { SettingsService } from '@/lib/settings-service'
import { upsertMultiVectorPoints } from '@/lib/qdrant'
import { getEmbeddingVectors } from '@/lib/langchain/embeddings'
import { Document } from '@langchain/core/documents'
import { randomUUID } from 'crypto'
import { ChunkingService } from '@/lib/chunking-service'
import { RAGSettings } from '@/lib/settings-service'
import { analyzeTextWithLLM } from '@/lib/metadata-analyzer'

/**
 * STAGE 2: Синхронизация с векторной БД
 *
 * Процесс:
 * 1. Находит файлы со статусом 'original_uploaded'
 * 2. Парсит их в текст
 * 3. Вычисляет txt_hash для дедупликации по содержанию
 * 4. Если содержимое уникально - создает эмбеддинг
 * 5. Сохраняет txt и метаданные
 * 6. Обновляет статус на 'embedded'
 */

export async function POST() {
  try {
    console.log('🔄 [SYNC STAGE 2] Starting synchronization with vector DB')

    const db = await getDatabase()

    // 1. Найти все файлы, ожидающие синхронизации
    const pendingFiles = db
      .prepare(
        `
      SELECT * FROM processed_files 
      WHERE processing_status = 'original_uploaded'
      ORDER BY uploaded_at ASC
    `
      )
      .all() as Array<{
      id: number
      original_filename: string
      storage_path: string
      file_hash: string
      mime_type: string
      uploaded_at: string
    }>

    if (pendingFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No files pending synchronization',
        processed: 0,
        skipped: 0,
        errors: 0,
      })
    }

    console.log(`📋 [SYNC] Found ${pendingFiles.length} files to process`)

    type ProcessResult = {
      fileId: number
      filename: string
      success: boolean
      skipped?: boolean
      reason?: string
      linkedTo?: string
      txtHash?: string
      textLength?: number
      chunksCreated?: number
      processingTime?: number
      txtPath?: string
      savedToDatabase?: boolean
      error?: string
    }

    const results: {
      processed: number
      skipped: number
      errors: number
      details: ProcessResult[]
    } = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // 2. Обработать каждый файл
    for (const file of pendingFiles) {
      try {
        console.log(`📁 [SYNC] Processing: ${file.original_filename}`)

        const fileResult = await processSingleFile(file)
        results.details.push(fileResult)

        if (fileResult.success) {
          if (fileResult.skipped) {
            results.skipped++
          } else {
            results.processed++
          }
        } else {
          results.errors++
        }
      } catch (error: unknown) {
        console.error(
          `❌ [SYNC] Error processing ${file.original_filename}:`,
          error
        )
        results.errors++
        results.details.push({
          fileId: file.id,
          filename: file.original_filename,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log(
      `✅ [SYNC] Completed: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`
    )

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed',
      ...results,
    })
  } catch (error: unknown) {
    console.error('❌ [SYNC] General error:', error)
    return NextResponse.json(
      {
        error: 'Synchronization failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'

/**
 * Обрабатывает один файл: парсинг → дедупликация → эмбеддинг
 */
type PendingFile = {
  id: number
  original_filename: string
  storage_path: string
  file_hash: string
  mime_type: string
  uploaded_at: string
  file_size?: number
}

async function processSingleFile(file: PendingFile) {
  const fileId = file.id
  const originalFilename = file.original_filename
  const storagePath = file.storage_path
  const fileHash = file.file_hash

  try {
    // 1. Читаем оригинальный файл
    const fullPath = join(process.cwd(), storagePath)
    const buffer = await readFile(fullPath)

    console.log(`📖 [SYNC] Read file: ${storagePath}`)

    // 2. Получаем процессор для этого типа файла
    const processor = documentProcessorFactory.getProcessor(
      originalFilename,
      file.mime_type
    )

    if (!processor) {
      throw new Error(`No processor found for file type: ${file.mime_type}`)
    }

    // 3. Извлекаем текст
    const text = await processor.extractText('', buffer)
    console.log(`📝 [SYNC] Extracted ${text.length} characters`)

    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from file')
    }

    // 4. Вычисляем txt_hash для дедупликации по содержанию
    const txtHash = calculateTextHash(text)
    console.log(`🔐 [SYNC] Text hash: ${txtHash.slice(0, 12)}...`)

    // 5. Проверяем дедупликацию по содержанию (STAGE 2 deduplication)
    const duplicateCheck = await checkTxtHashExists(txtHash)

    if (duplicateCheck.exists) {
      console.log(
        `🔗 [SYNC] Content already exists, linking to: ${duplicateCheck.originalFilename}`
      )

      // Обновляем статус на 'duplicate_content' и связываем с существующим
      const db = await getDatabase()
      db.prepare(
        `
        UPDATE processed_files 
        SET processing_status = 'duplicate_content', 
            txt_hash = ?,
            processed_at = ?
        WHERE id = ?
      `
      ).run(txtHash, new Date().toISOString(), fileId)

      return {
        fileId,
        filename: originalFilename,
        success: true,
        skipped: true,
        reason: 'duplicate_content',
        linkedTo: duplicateCheck.originalFilename,
        txtHash: txtHash.slice(0, 12) + '...',
      }
    }

    // 6. Содержимое уникально - продолжаем обработку
    console.log(
      `✨ [SYNC] Unique content, enriching metadata and creating embedding...`
    )

    // 6.1 Обогащение метаданных (синхронно, по настройкам)
    let llmMetadata: Record<string, unknown> | undefined
    try {
      const enhancedEnabled = await SettingsService.getSettingValue<boolean>(
        'enhanced_metadata_enabled',
        true
      )
      if (enhancedEnabled) {
        const strategy = await SettingsService.getSettingValue<string>(
          'metadata_strategy',
          'auto'
        )
        const maxTokens = await SettingsService.getSettingValue<number>(
          'metadata_max_context_tokens',
          120000
        )
        const approxTokenLimit = Math.max(8000, maxTokens)
        const approxTokens = Math.ceil(text.length / 4)

        let sampleText = text
        if (
          strategy === 'sampled' ||
          (strategy === 'auto' && approxTokens > approxTokenLimit)
        ) {
          const sliceTokens = Math.floor(approxTokenLimit / 2)
          const sliceChars = sliceTokens * 4
          const head = text.slice(0, sliceChars)
          const tail = text.slice(-sliceChars)
          sampleText = `${head}\n\n[...]\n\n${tail}`
        } else if (strategy === 'hierarchical') {
          const sliceTokens = Math.floor(approxTokenLimit / 3)
          const sliceChars = sliceTokens * 4
          const head = text.slice(0, sliceChars)
          const midStart = Math.max(0, Math.floor(text.length / 2) - sliceChars)
          const mid = text.slice(midStart, midStart + sliceChars)
          const tail = text.slice(-sliceChars)
          sampleText = `${head}\n\n[...]\n\n${mid}\n\n[...]\n\n${tail}`
        }

        const spiritual = await RAGSettings.isSpiritualPromptEnabled()
        const domain = spiritual ? 'spiritual' : 'nutrition'
        llmMetadata = await analyzeTextWithLLM(sampleText, domain)
      }
    } catch (e) {
      console.warn('⚠️ [SYNC] LLM metadata enrichment failed, continuing:', e)
    }

    // 7. Генерируем путь для txt файла (без метаданных)
    const { txtPath, folder } = generateTxtFilePaths(txtHash)

    // Создаем папку
    await mkdir(join(process.cwd(), folder), { recursive: true })

    // 8. Сохраняем txt файл
    const fullTxtPath = join(process.cwd(), txtPath)
    await writeFile(fullTxtPath, text, 'utf8')
    console.log(`💾 [SYNC] Saved txt: ${txtPath}`)

    const startTime = Date.now()

    // 9. Создаем чанки для эмбеддинга
    const chunks = await ChunkingService.splitText(text)
    console.log(`📋 [SYNC] Created ${chunks.length} chunks`)

    // 10. Создаем документы для векторной БД
    const documents = chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.content,
          metadata: {
            fileId: fileId,
            filename: originalFilename,
            mimeType: file.mime_type,
            size: file.file_size,
            fileHash: fileHash,
            txtHash: txtHash,
            chunkIndex: chunk.index,
            chunkStart: chunk.start,
            chunkEnd: chunk.end,
            tokenCount: chunk.tokenCount,
            uploadedAt: file.uploaded_at,
            processedAt: new Date().toISOString(),
            // Обогащенные метаданные на уровне файла
            llmMetadata,
          },
        })
    )

    // 11. Добавляем в векторную БД (single or multi-vector)
    const multivectorEnabled = await SettingsService.getSettingValue<boolean>(
      'multivector_enabled',
      false
    )
    if (multivectorEnabled) {
      const ids = documents.map(() => randomUUID())
      const contentTexts = documents.map((d) => d.pageContent)
      const metaTexts = documents.map((d) => {
        const meta = d.metadata as Record<string, unknown>
        const llm = (meta?.llmMetadata as Record<string, unknown>) || {}
        const title = String(
          (llm as { title?: unknown })?.title ||
            (meta as { title?: unknown })?.title ||
            ''
        )
        const tagsArr = (llm as { tags?: unknown })?.tags
        const tags = Array.isArray(tagsArr)
          ? (tagsArr as unknown[]).map(String).join(' ')
          : ''
        const summary = String(
          (llm as { summaryShort?: unknown; summary?: unknown })
            ?.summaryShort ||
            (llm as { summary?: unknown })?.summary ||
            ''
        )
        return [title, tags, summary]
          .filter((s) => s && s.length > 0)
          .join(' \n ')
      })
      const [contentVecs, metaVecs] = await Promise.all([
        getEmbeddingVectors(contentTexts),
        getEmbeddingVectors(metaTexts),
      ])
      console.log(
        `🧮 [SYNC] Multi-vector embeddings ready (content dim=${contentVecs[0]?.length}, meta dim=${metaVecs[0]?.length})`
      )
      console.log('🧪 [SYNC] Meta text sample:', metaTexts[0]?.slice(0, 120))
      await upsertMultiVectorPoints(
        ids.map((id, i) => ({
          id,
          contentVector: contentVecs[i],
          metaVector: metaVecs[i],
          payload: {
            content: documents[i].pageContent,
            metadata: documents[i].metadata as Record<string, unknown>,
          },
        }))
      )
    } else {
      await addDocuments(documents)
    }

    const processingTime = Date.now() - startTime
    console.log(
      `🗄️ [SYNC] Added ${documents.length} documents to vector store in ${processingTime}ms`
    )

    // 12. Создаем метаданные для сохранения в БД (не в файл!)
    const metadata = {
      file_hash: fileHash,
      txt_hash: txtHash,
      original_filename: originalFilename,
      original_format:
        originalFilename.split('.').pop()?.toLowerCase() || 'unknown',
      upload_date: file.uploaded_at,
      file_size: file.file_size,
      text_length: text.length,
      language: 'ru',
      processing_time: processingTime,
      chunks_created: chunks.length,
      llm_metadata: llmMetadata,
    }

    console.log(`📋 [SYNC] Metadata prepared for DB storage (no .meta.json)`)

    // 13. Обновляем статус в БД со всеми метаданными
    const db = await getDatabase()
    db.prepare(
      `
      UPDATE processed_files 
      SET processing_status = 'embedded',
          txt_hash = ?,
          txt_path = ?,
          text_length = ?,
          language = ?,
          chunks_created = ?,
          processing_time_ms = ?,
          embedded_at = ?,
          processed_at = ?,
          metadata_json = ?
      WHERE id = ?
    `
    ).run(
      txtHash,
      txtPath,
      text.length,
      'ru',
      chunks.length,
      processingTime,
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify(metadata),
      fileId
    )

    console.log(`✅ [SYNC] Successfully processed: ${originalFilename}`)

    return {
      fileId,
      filename: originalFilename,
      success: true,
      skipped: false,
      txtHash: txtHash.slice(0, 12) + '...',
      textLength: text.length,
      chunksCreated: chunks.length,
      processingTime,
      txtPath,
      savedToDatabase: true,
    }
  } catch (error: unknown) {
    console.error(`❌ [SYNC] Error processing ${originalFilename}:`, error)

    // Обновляем статус на 'failed' с сообщением об ошибке
    try {
      const db = await getDatabase()
      db.prepare(
        `
        UPDATE processed_files 
        SET processing_status = 'failed',
            error_message = ?,
            processed_at = ?
        WHERE id = ?
      `
      ).run(
        error instanceof Error ? error.message : String(error),
        new Date().toISOString(),
        fileId
      )
    } catch (dbError) {
      console.error(
        `❌ [SYNC] Could not update error status for ${originalFilename}:`,
        dbError
      )
    }

    return {
      fileId,
      filename: originalFilename,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * GET endpoint для получения статистики синхронизации
 */
export async function GET() {
  try {
    const db = await getDatabase()

    const stats = db
      .prepare(
        `
      SELECT 
        processing_status,
        COUNT(*) as count
      FROM processed_files 
      GROUP BY processing_status
    `
      )
      .all() as Array<{
      processing_status: keyof typeof statusMap
      count: number
    }>

    const totalFiles = db
      .prepare(`SELECT COUNT(*) as count FROM processed_files`)
      .get() as { count: number }

    const statusMap = {
      original_uploaded: 0,
      embedded: 0,
      duplicate_content: 0,
      failed: 0,
    }

    stats.forEach((stat) => {
      statusMap[stat.processing_status] = stat.count
    })

    return NextResponse.json({
      success: true,
      statistics: {
        totalFiles: totalFiles.count,
        pendingSync: statusMap.original_uploaded,
        embedded: statusMap.embedded,
        duplicateContent: statusMap.duplicate_content,
        failed: statusMap.failed,
        syncNeeded: statusMap.original_uploaded > 0,
      },
    })
  } catch (error) {
    console.error('❌ [SYNC STATS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync statistics' },
      { status: 500 }
    )
  }
}
