#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'
import PptxGenJS from 'pptxgenjs'

type Bullet = string | { text: string; options?: PptxGenJS.TextPropsOptions }

function addTitleSlide(pptx: PptxGenJS, title: string, subtitle?: string) {
  const slide = pptx.addSlide()
  slide.addText(title, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 1.2,
    fontSize: 36,
    bold: true,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 2.2,
      w: 9,
      fontSize: 18,
      color: '666666',
    })
  }
}

function normalizeBullets(
  items: Bullet[]
): Array<{ text: string; options?: PptxGenJS.TextPropsOptions }> {
  return items.map((it) => (typeof it === 'string' ? { text: it } : it))
}

function addBulletsSlide(pptx: PptxGenJS, title: string, bullets: Bullet[]) {
  const slide = pptx.addSlide()
  slide.addText(title, { x: 0.5, y: 0.6, w: 9, fontSize: 28, bold: true })
  slide.addText(normalizeBullets(bullets) as any, {
    x: 0.7,
    y: 1.4,
    w: 9,
    fontSize: 18,
    color: '202020',
    bullet: { type: 'number' },
    lineSpacing: 24,
  })
}

function addTwoColumnSlide(
  pptx: PptxGenJS,
  title: string,
  leftTitle: string,
  leftBullets: Bullet[],
  rightTitle: string,
  rightBullets: Bullet[]
) {
  const slide = pptx.addSlide()
  slide.addText(title, { x: 0.5, y: 0.6, w: 9, fontSize: 28, bold: true })
  slide.addText(leftTitle, { x: 0.5, y: 1.3, w: 4.5, fontSize: 20, bold: true })
  slide.addText(normalizeBullets(leftBullets) as any, {
    x: 0.5,
    y: 1.8,
    w: 4.5,
    fontSize: 16,
    bullet: true,
    lineSpacing: 20,
  })
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.1,
    y: 1.2,
    w: 0.05,
    h: 5.0,
    fill: { color: 'DDDDDD' },
    line: { color: 'DDDDDD' },
  })
  slide.addText(rightTitle, {
    x: 5.3,
    y: 1.3,
    w: 4.2,
    fontSize: 20,
    bold: true,
  })
  slide.addText(normalizeBullets(rightBullets) as any, {
    x: 5.3,
    y: 1.8,
    w: 4.2,
    fontSize: 16,
    bullet: true,
    lineSpacing: 20,
  })
}

function addCodeSlide(pptx: PptxGenJS, title: string, code: string) {
  const slide = pptx.addSlide()
  slide.addText(title, { x: 0.5, y: 0.6, w: 9, fontSize: 28, bold: true })
  slide.addText(code, {
    x: 0.5,
    y: 1.3,
    w: 9,
    h: 5.0,
    fontFace: 'Courier New',
    fontSize: 14,
    color: '1F2937',
    fill: { color: 'F8FAFC' },
    line: { color: 'E5E7EB' },
    margin: 12,
  })
}

async function main() {
  const outDir = path.join(process.cwd(), 'docs')
  fs.mkdirSync(outDir, { recursive: true })

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Nutralogos'
  pptx.subject = 'RAG Chat System'
  pptx.title = 'Nutralogos RAG Overview'

  // 1) Title
  addTitleSlide(
    pptx,
    'Nutralogos RAG Chat',
    'Retrieval-Augmented Generation: Nutrition & Spiritual domains'
  )

  // 2) Objectives
  addBulletsSlide(pptx, 'Project Objectives', [
    'Single source of truth for Qdrant collection via .env',
    'Robust ingestion: upload → parse → analyze → chunk → embed → index',
    'Pre-embedding LLM metadata for better retrieval and filtering',
    'Dual-domain support (nutrition / spiritual) via admin settings',
    'Admin UX: stats, sync queue incl. reprocessing of failed files',
  ])

  // 3) Architecture
  addTwoColumnSlide(
    pptx,
    'High-level Architecture',
    'Core Components',
    [
      'Next.js API routes (/api/upload, /api/sync, /api/ask, /api/stats)',
      'SQLite for files, statuses, settings, metadata JSON',
      'Qdrant vector DB with payload indexes for filtering',
      'OpenAI embeddings (text-embedding-3-small) [pluggable]',
      'LLM metadata analysis (gpt-4o-mini) with fallbacks',
    ],
    'Data Flow',
    [
      'Upload originals → deduplicate by hash',
      'Parse text (pdfjs-dist primary, pdf2json/regex fallback)',
      'Analyze full text → JSON metadata',
      'Chunk + embed → Qdrant upsert (deterministic IDs)',
      'Query: filter by metadata → vector search → answer',
    ]
  )

  // 4) Ingestion pipeline
  addBulletsSlide(pptx, 'Ingestion Pipeline', [
    { text: 'Stage 1: Upload', options: { bold: true } },
    'Save originals, compute original_hash, store in SQLite',
    { text: 'Stage 2: Parse', options: { bold: true } },
    'Extract text: pdfjs-dist → pdf2json → regex fallback; guard against diagnostic text',
    { text: 'Stage 3: Analyze', options: { bold: true } },
    'LLM produces summary, topics, suggested_tags, target_conditions, entities, tone, etc.',
    { text: 'Stage 4: Chunk + Embed', options: { bold: true } },
    'Chunk settings from admin; embeddings → Qdrant with rich payload',
  ])

  // 5) PDF parsing
  addBulletsSlide(pptx, 'PDF Parsing Strategy', [
    'Primary: pdfjs-dist (page textContent with spatial grouping)',
    'Fallback 1: pdf2json (clean spacing, join letters, normalize)',
    'Fallback 2: regex (BT/ET, Tj/TJ streams) as last resort',
    'Avoid external binaries (pdftotext); pure-JS pipeline',
    'Prevents saving diagnostic strings as parsed text',
  ])

  // 6) Metadata
  addTwoColumnSlide(
    pptx,
    'Pre-embedding Metadata',
    'What we extract',
    [
      'summary, topics, context_intent',
      'named_entities, emotional_tone',
      'suggested_tags, target_conditions',
      'author/author_type, source_type',
    ],
    'Where we store',
    [
      'SQLite: raw JSON (+ selected fields)',
      'Qdrant payload: fields for filtering',
      'Indexes: domain, topics, target_conditions, named_entities, txtHash',
    ]
  )

  // 7) Qdrant / SQLite
  addTwoColumnSlide(
    pptx,
    'Storage & Indexing',
    'Qdrant',
    [
      'Collection from .env (QDRANT_COLLECTION_NAME)',
      'Deterministic point IDs: `${txtHash}:${chunkIndex}`',
      'Keyword payload indexes for fast filters',
    ],
    'SQLite',
    [
      'files, processed_files, chunks, uploads_log',
      'hash-based deduplication (original/text)',
      'settings incl. domain / metadata_model / metadata_prompt',
    ]
  )

  // 8) Admin UI
  addBulletsSlide(pptx, 'Admin UI', [
    'Stats: total files, pending sync including failed',
    'Settings: domain, metadata model, custom prompts, chunking',
    'Sync button: processes new + previously failed files',
    'Optional: show metadata (summary/topics) in results',
  ])

  // 9) Retrieval flow
  addBulletsSlide(pptx, 'Retrieval (Ask)', [
    'Step 1: Build filter from query context (domain/topics/tags/conditions)',
    'Step 2: Vector search in Qdrant',
    'Step 3: Compose answer with source chunks (clean content)',
    'Streaming via WebSocket to frontend',
  ])

  // 10) Configuration
  addCodeSlide(
    pptx,
    'Configuration (.env)',
    `# Qdrant
QDRANT_URL=...
QDRANT_API_KEY=...
QDRANT_COLLECTION_NAME=documents

# OpenAI (or proxy)
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
`
  )

  // 11) Reset & migrations
  addBulletsSlide(pptx, 'Reset & Migrations', [
    'scripts/reset-stores.ts: drop Qdrant collection, clear SQLite tables',
    'scripts/migrate-settings.ts: add settings (domain, metadata_model, metadata_prompt)',
    'Idempotent upserts via deterministic IDs',
  ])

  // 12) Roadmap
  addBulletsSlide(pptx, 'Roadmap', [
    'UI: show metadata summary/topics near answers',
    'More retrieval filters & semantic reranking',
    'Add provider fallbacks for embeddings/LLM when region-locked',
    'Export/import datasets; multi-collection support in admin',
  ])

  const outFile = path.join(outDir, 'Nutralogos-RAG-Overview.pptx')
  await pptx.writeFile({ fileName: outFile })
  console.log(`✅ Presentation generated: ${outFile}`)
}

main().catch((err) => {
  console.error('Failed to generate presentation:', err)
  process.exit(1)
})
