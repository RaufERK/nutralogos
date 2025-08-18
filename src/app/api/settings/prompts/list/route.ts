import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const dir = join(process.cwd(), 'src', 'defaults', 'prompts')
    const files = await readdir(dir)
    const txtFiles = files.filter((f) => f.toLowerCase().endsWith('.txt'))
    const prompts = await Promise.all(
      txtFiles.map(async (filename) => {
        const filepath = join(dir, filename)
        const content = await readFile(filepath, 'utf8')
        return {
          name: filename.replace(/\.txt$/i, ''),
          filename,
          content,
        }
      })
    )
    return NextResponse.json({ success: true, prompts })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
