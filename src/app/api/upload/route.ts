import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { documentProcessorFactory } from '@/lib/document-processors-clean'
import {
  calculateFileHash,
  generateOriginalFilePath,
  sanitizeFilename,
  checkFileHashExists,
  createFileMetadata,
} from '@/lib/file-hash-utils'
import { getDatabase } from '@/lib/database'
import {
  checkAndIncrementRateLimit,
  getClientKeyFromRequest,
} from '@/lib/rate-limit'
import { RAGSettings } from '@/lib/settings-service'

export async function POST(request: NextRequest) {
  try {
    const ipKey = getClientKeyFromRequest(
      request as unknown as Request,
      'ip-unknown'
    )
    const rate = await checkAndIncrementRateLimit({
      route: '/api/upload',
      key: ipKey,
      limit: 10,
      window: 'hour',
    })
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Too many uploads', retry_after_seconds: rate.reset },
        { status: 429, headers: { 'Retry-After': String(rate.reset) } }
      )
    }

    console.log('📤 [UPLOAD STAGE 1] Processing file upload to library')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const testMode = formData.get('testMode') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(
      `📁 [UPLOAD] File: ${file.name} (${file.size} bytes, ${file.type})`
    )

    // Validate file size (from settings, fallback 100MB)
    const maxSizeMB = await RAGSettings.getMaxFileSizeMB().catch(() => 100)
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Max size: ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // Get processor to validate format
    const processor = documentProcessorFactory.getProcessor(
      file.name,
      file.type
    )
    if (!processor) {
      const supportedExtensions =
        documentProcessorFactory.getSupportedExtensions()
      return NextResponse.json(
        {
          error: `Unsupported file format. Supported: ${supportedExtensions.join(
            ', '
          )}`,
        },
        { status: 400 }
      )
    }

    console.log(`🔧 [UPLOAD] Format supported: ${processor.constructor.name}`)

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate file content
    if (!processor.validateFile(buffer)) {
      return NextResponse.json(
        { error: 'File validation failed - invalid content' },
        { status: 400 }
      )
    }

    // Calculate file hash for deduplication BEFORE saving
    const fileHash = calculateFileHash(buffer)
    console.log(`🔐 [UPLOAD] File hash: ${fileHash.slice(0, 12)}...`)

    // Check if file already exists in database (STAGE 1 deduplication)
    const fileExists = await checkFileHashExists(fileHash)
    if (fileExists) {
      console.log(`📋 [UPLOAD] File already in library: ${file.name}`)
      return NextResponse.json({
        success: false,
        error: 'File already exists in library',
        message: 'This file has already been uploaded to the library',
        fileHash: fileHash.slice(0, 12) + '...',
        duplicate: true,
      })
    }

    // If in test mode, do quick text extraction for preview
    if (testMode === 'true') {
      try {
        const text = await processor.extractText('', buffer)
        console.log(`📝 [TEST] Extracted ${text.length} characters`)

        return NextResponse.json({
          success: true,
          filename: file.name,
          size: file.size,
          type: file.type,
          processor: processor.constructor.name,
          textLength: text.length,
          preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
          testMode: true,
          fileHash: fileHash.slice(0, 12) + '...',
          message: 'Test mode - file not saved',
        })
      } catch {
        return NextResponse.json(
          { error: 'Could not extract text for preview' },
          { status: 400 }
        )
      }
    }

    // STAGE 1: Save original file to library (только после проверки дедупликации)
    try {
      // Sanitize filename for safe storage
      const sanitizedFilename = sanitizeFilename(file.name)

      // Generate storage path with date folder
      const storagePath = generateOriginalFilePath(sanitizedFilename)
      const fullPath = join(process.cwd(), storagePath)

      // Create directory if it doesn't exist
      const now = new Date()
      const date = now.toISOString().split('T')[0] // YYYY-MM-DD
      const time = now
        .toTimeString()
        .split(' ')[0]
        .slice(0, 5)
        .replace(':', '-') // HH-MM
      const dateTimeFolder = `${date}_${time}`

      await mkdir(join(process.cwd(), 'uploads', 'original', dateTimeFolder), {
        recursive: true,
      })

      // Save original file
      await writeFile(fullPath, buffer)
      console.log(`💾 [UPLOAD] Saved original file: ${storagePath}`)

      // Create metadata
      const metadata = createFileMetadata(fileHash, file.name, file.size, {
        original_format: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      })

      // Save to database with status 'original_uploaded'
      const db = await getDatabase()
      const result = db
        .prepare(
          `
        INSERT INTO processed_files (
          file_hash, original_filename, original_format, file_size, mime_type,
          processing_status, storage_path, metadata_json, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          fileHash,
          file.name,
          file.name.split('.').pop()?.toLowerCase() || 'unknown',
          file.size,
          file.type,
          'original_uploaded',
          storagePath,
          JSON.stringify(metadata),
          new Date().toISOString()
        )

      const fileId = result.lastInsertRowid
      console.log(`✅ [UPLOAD] File added to library: ID ${fileId}`)

      return NextResponse.json({
        success: true,
        message: 'File successfully added to library',
        stage: 'original_uploaded',
        fileId: fileId,
        filename: file.name,
        size: file.size,
        fileHash: fileHash.slice(0, 12) + '...',
        storagePath: storagePath,
        processor: processor.constructor.name,
        nextStep: 'Use "Sync with Vector DB" button to process for search',
      })
    } catch (storageError: unknown) {
      console.error('❌ [UPLOAD] Storage error:', storageError)
      return NextResponse.json(
        {
          error: 'Failed to save file to library',
          details:
            storageError instanceof Error
              ? storageError.message
              : String(storageError),
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ [UPLOAD] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
