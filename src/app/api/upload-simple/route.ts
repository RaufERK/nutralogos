import { NextRequest, NextResponse } from 'next/server'
import { documentProcessorFactory } from '@/lib/document-processors-clean'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [SIMPLE UPLOAD] Processing file upload request')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const testMode = formData.get('testMode') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(
      `📁 [SIMPLE UPLOAD] File: ${file.name} (${file.size} bytes, ${file.type})`
    )

    // Get processor
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

    console.log(
      `🔧 [SIMPLE UPLOAD] Using processor: ${processor.constructor.name}`
    )

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate file
    if (!processor.validateFile(buffer)) {
      return NextResponse.json(
        { error: 'File validation failed' },
        { status: 400 }
      )
    }

    // Extract text
    const text = await processor.extractText('', buffer)

    console.log(`📝 [SIMPLE UPLOAD] Extracted ${text.length} characters`)

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      type: file.type,
      processor: processor.constructor.name,
      textLength: text.length,
      preview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      testMode: !!testMode,
    })
  } catch (error: unknown) {
    console.error('❌ [SIMPLE UPLOAD] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
