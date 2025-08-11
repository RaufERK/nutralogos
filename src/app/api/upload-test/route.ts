import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [UPLOAD-TEST] Simple upload test endpoint')

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(
      `📁 [UPLOAD-TEST] File: ${file.name}, size: ${file.size}, type: ${file.type}`
    )

    // Just read the file without processing
    const buffer = await file.arrayBuffer()
    const text = new TextDecoder().decode(buffer).substring(0, 100)

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      type: file.type,
      preview: text,
    })
  } catch (error: unknown) {
    console.error('❌ [UPLOAD-TEST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
