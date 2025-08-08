import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, unlink, rmdir, stat } from 'fs/promises'
import path, { join, dirname } from 'path'
import os from 'os'

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json()

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), filename)
    const buffer = await readFile(filePath)

    const normalize = (text: string) =>
      text
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .split('\n')
        .map((l) => l.replace(/[ \t]+$/g, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    const extractWithPath = (pdfPath: string) =>
      new Promise<string>((resolve, reject) => {
        try {
          const extract = require('pdf-text-extract')
          const options = { splitPages: false }
          extract(pdfPath, options, (err: any, text: string | string[]) => {
            if (err) return reject(err)
            const joined = Array.isArray(text) ? text.join('\n\n') : text
            resolve(normalize(joined || ''))
          })
        } catch (e) {
          reject(e)
        }
      })

    let tempFile: string | null = null
    let text = ''

    try {
      await stat(filePath)
      text = await extractWithPath(filePath)
    } catch {
      const tmpDir = await mkdir(join(os.tmpdir(), 'pdfx-test'), {
        recursive: true,
      })
      tempFile = join(os.tmpdir(), 'pdfx-test', 'input.pdf')
      await writeFile(tempFile, buffer)
      text = await extractWithPath(tempFile)
    }

    return NextResponse.json({
      success: true,
      filename,
      size: buffer.length,
      textLength: text.length,
      preview: text.substring(0, 1000),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Extraction failed' },
      { status: 500 }
    )
  }
}
