import { readdir, readFile, mkdir, writeFile, stat } from 'fs/promises'
import { join, extname, basename } from 'path'

async function parseWithPdfParse(buffer: Buffer) {
  try {
    const mod: any = await import('pdf-parse')
    const pdfParseFn: any = mod?.default || mod
    const data = await pdfParseFn(buffer)
    return { name: 'pdf-parse', ok: true, text: data?.text || '' }
  } catch (e: any) {
    return { name: 'pdf-parse', ok: false, error: e?.message || String(e) }
  }
}

async function parseWithPdfJs(buffer: Buffer) {
  try {
    const pdfjsLib: any = await import('pdfjs-dist/build/pdf.js')
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })
    const pdf = await loadingTask.promise
    const textParts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item: any) => item.str).join(' ')
      textParts.push(pageText)
    }
    return { name: 'pdfjs-dist', ok: true, text: textParts.join('\n\n') }
  } catch (e: any) {
    return { name: 'pdfjs-dist', ok: false, error: e?.message || String(e) }
  }
}

async function parseWithPdf2Json(buffer: Buffer) {
  try {
    const PDFParser = require('pdf2json')
    const pdfParser = new PDFParser(null, 1)
    const json: any = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (err: any) =>
        reject(err?.parserError || err)
      )
      pdfParser.on('pdfParser_dataReady', (data: any) => resolve(data))
      pdfParser.parseBuffer(buffer)
    })
    const pages = json?.Pages || json?.formImage?.Pages || []
    const allText: string[] = []
    for (const page of pages) {
      const texts = page.Texts || []
      const pageTexts: string[] = []
      for (const t of texts) {
        if (t.R)
          for (const r of t.R) if (r.T) pageTexts.push(decodeURIComponent(r.T))
      }
      if (pageTexts.length) allText.push(pageTexts.join(' '))
    }
    return { name: 'pdf2json', ok: true, text: allText.join('\n\n') }
  } catch (e: any) {
    return { name: 'pdf2json', ok: false, error: e?.message || String(e) }
  }
}

async function parseWithPdfReader(buffer: Buffer) {
  try {
    const { PdfReader } = require('pdfreader')
    const items: string[] = []
    await new Promise((resolve, reject) => {
      new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
        if (err) return reject(err)
        if (!item) return resolve(items)
        if (item.text) items.push(item.text)
      })
    })
    return { name: 'pdfreader', ok: true, text: items.join(' ') }
  } catch (e: any) {
    return { name: 'pdfreader', ok: false, error: e?.message || String(e) }
  }
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

async function run() {
  const folder = process.argv[2] || 'uploads/original/2025-08-08_00-10'
  const outRoot = join(
    'uploads',
    'txt-test',
    new Date().toISOString().slice(0, 16).replace(/:/g, '-')
  )
  await ensureDir(outRoot)

  const entries = await readdir(folder)
  const pdfs = entries.filter((f) => extname(f).toLowerCase() === '.pdf')

  const report: any[] = []

  for (const f of pdfs) {
    const full = join(folder, f)
    const s = await stat(full)
    if (!s.isFile()) continue
    const buffer = await readFile(full)

    const results = await Promise.all([
      parseWithPdfParse(buffer),
      parseWithPdfJs(buffer),
      parseWithPdf2Json(buffer),
      parseWithPdfReader(buffer),
    ])

    const successful = results.filter((r) => r.ok)
    const best = successful.sort(
      (a, b) => (b.text?.length || 0) - (a.text?.length || 0)
    )[0]

    const base = basename(f, '.pdf')
    const outFile = join(outRoot, `${base}.txt`)
    const metaFile = join(outRoot, `${base}.meta.json`)

    if (best?.text && best.text.trim()) {
      await writeFile(outFile, best.text, 'utf8')
    } else {
      await writeFile(outFile, `PARSE_FAILED`, 'utf8')
    }

    await writeFile(
      metaFile,
      JSON.stringify(
        {
          file: full,
          size: buffer.length,
          results: results.map((r) => ({
            name: r.name,
            ok: r.ok,
            textLength: r.ok ? r.text.length : 0,
            error: r.ok ? undefined : r.error,
          })),
          best: best ? { name: best.name, textLength: best.text.length } : null,
        },
        null,
        2
      ),
      'utf8'
    )

    report.push({
      file: full,
      size: buffer.length,
      best: best ? { name: best.name, textLength: best.text.length } : null,
      summary: results.reduce((acc: any, r) => {
        acc[r.name] = r.ok ? r.text.length : `ERR: ${r.error}`
        return acc
      }, {}),
    })
  }

  console.log(JSON.stringify({ folder, outRoot, files: report }, null, 2))
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
