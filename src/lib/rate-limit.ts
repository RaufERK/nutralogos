import { getDatabase } from './database'
import type Database from 'better-sqlite3'

type WindowSize = 'minute' | 'ten_minutes' | 'hour'

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function floorToWindowStart(
  epochSeconds: number,
  windowSize: WindowSize
): number {
  const size =
    windowSize === 'minute' ? 60 : windowSize === 'ten_minutes' ? 600 : 3600
  return epochSeconds - (epochSeconds % size)
}

export async function checkAndIncrementRateLimit(options: {
  route: string
  key: string
  limit: number
  window: WindowSize
  block?: { threshold: number; durationSec: number; reason?: string }
}): Promise<
  | { ok: true; remaining: number; reset: number }
  | { ok: false; status: 429; reset: number; message: string }
> {
  const now = nowEpochSeconds()
  const windowStart = floorToWindowStart(now, options.window)

  const mem = memoryCheckAndIncrement(
    options.route,
    options.key,
    windowStart,
    options.window,
    options.limit,
    options.block
  )
  if (!mem.ok) return mem

  persistCounterAsync(
    options.route,
    options.key,
    windowStart,
    mem.current,
    options.block
  )

  return {
    ok: true,
    remaining: Math.max(0, options.limit - mem.current),
    reset: mem.reset,
  }
}

function upsertAndGetCount(
  db: Database.Database,
  route: string,
  key: string,
  windowStart: number
): number {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO rate_limits (route, key, window_start, count) VALUES (?, ?, ?, 0)`
  )
  insert.run(route, key, windowStart)

  const update = db.prepare(
    `UPDATE rate_limits SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE route = ? AND key = ? AND window_start = ?`
  )
  update.run(route, key, windowStart)

  const row = db
    .prepare(
      `SELECT count FROM rate_limits WHERE route = ? AND key = ? AND window_start = ?`
    )
    .get(route, key, windowStart) as { count: number } | undefined
  return row?.count ?? 0
}

function isBlocked(
  db: Database.Database,
  route: string,
  key: string
): { block_until: Date; reason?: string } | null {
  const row = db
    .prepare(
      `SELECT block_until, reason FROM rate_blocks WHERE route = ? AND key = ?`
    )
    .get(route, key) as { block_until: string; reason?: string } | undefined
  if (!row) return null
  const until = new Date(row.block_until)
  if (until.getTime() > Date.now()) {
    return { block_until: until, reason: row.reason }
  }
  // Expired block — cleanup
  db.prepare(`DELETE FROM rate_blocks WHERE route = ? AND key = ?`).run(
    route,
    key
  )
  return null
}

function setBlock(
  db: Database.Database,
  route: string,
  key: string,
  until: Date,
  reason?: string
): void {
  db.prepare(
    `INSERT OR REPLACE INTO rate_blocks (route, key, block_until, reason) VALUES (?, ?, ?, ?)`
  ).run(route, key, until.toISOString(), reason ?? null)
}

export function getClientKeyFromRequest(
  req: Request,
  fallbackIP = 'unknown'
): string {
  try {
    const ip =
      req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    if (ip) return String(ip)
  } catch {}
  return fallbackIP
}

// In-memory fast path to cut SQLite I/O for hot paths
type BlockRule = { threshold: number; durationSec: number; reason?: string }
type MemEntry = { count: number; windowStart: number; blockedUntil?: number }
const memCounters = new Map<string, MemEntry>()

function memKey(route: string, key: string, windowStart: number): string {
  return `${route}|${key}|${windowStart}`
}

function windowSizeSeconds(window: WindowSize): number {
  return window === 'minute' ? 60 : window === 'ten_minutes' ? 600 : 3600
}

function memoryCheckAndIncrement(
  route: string,
  key: string,
  windowStart: number,
  window: WindowSize,
  limit: number,
  block?: BlockRule
):
  | { ok: true; current: number; reset: number }
  | { ok: false; status: 429; reset: number; message: string } {
  const size = windowSizeSeconds(window)
  const reset = windowStart + size - nowEpochSeconds()
  const k = memKey(route, key, windowStart)
  const entry = memCounters.get(k) || { count: 0, windowStart }
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
    return { ok: false, status: 429, reset, message: 'Too many requests' }
  }
  entry.count += 1
  memCounters.set(k, entry)
  if (entry.count > limit) {
    if (block && entry.count >= block.threshold) {
      entry.blockedUntil = Date.now() + block.durationSec * 1000
      memCounters.set(k, entry)
    }
    return { ok: false, status: 429, reset, message: 'Too many requests' }
  }
  return { ok: true, current: entry.count, reset }
}

async function persistCounterAsync(
  route: string,
  key: string,
  windowStart: number,
  current: number,
  block?: BlockRule
): Promise<void> {
  if (current % 5 !== 0 && current !== 1) return
  try {
    const db = await getDatabase()
    const persisted = upsertAndGetCount(db, route, key, windowStart)
    if (block && persisted >= block.threshold) {
      setBlock(
        db,
        route,
        key,
        new Date(Date.now() + block.durationSec * 1000),
        block.reason || 'Rate limit exceeded'
      )
    }
  } catch {
    // ignore
  }
}
