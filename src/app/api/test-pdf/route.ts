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
      new Promise<string>(async (resolve, reject) => {
        try {
          const mod = await import('pdf-text-extract')
          const modDefault = (mod as unknown as { default?: unknown }).default
          const extractCandidate = (modDefault ?? (mod as unknown)) as unknown
          const extract = extractCandidate as (
            path: string,
            opts: { splitPages: boolean },
            cb: (err: unknown, text: string | string[]) => void
          ) => void
          const options = { splitPages: false }
          extract(pdfPath, options, (err: unknown, text: string | string[]) => {
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
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      },
      { status: 500 }
    )
  }
}
