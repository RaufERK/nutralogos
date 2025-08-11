import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [MINIMAL UPLOAD] Starting minimal upload test')

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    console.log(`📁 [MINIMAL UPLOAD] File: ${file.name}`)

    // Just read the file as text for TXT files
    if (file.name.endsWith('.txt')) {
      const buffer = await file.arrayBuffer()
      const text = new TextDecoder().decode(buffer)

      return NextResponse.json({
        success: true,
        filename: file.name,
        size: file.size,
        textLength: text.length,
        preview: text.substring(0, 100),
      })
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      message:
        'File received but not processed (only TXT supported in minimal mode)',
    })
  } catch (error: unknown) {
    console.error('❌ [MINIMAL UPLOAD] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
