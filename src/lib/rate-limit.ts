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
  const db = await getDatabase()
  const now = nowEpochSeconds()
  const windowStart = floorToWindowStart(now, options.window)

  const blocked = isBlocked(db, options.route, options.key)
  if (blocked) {
    const { block_until, reason } = blocked
    const reset = Math.max(0, Math.floor(block_until.getTime() / 1000) - now)
    return {
      ok: false,
      status: 429,
      reset,
      message: reason || 'Too many requests. Try again later.',
    }
  }

  const current = upsertAndGetCount(db, options.route, options.key, windowStart)

  if (current > options.limit) {
    if (options.block && current >= options.block.threshold) {
      setBlock(
        db,
        options.route,
        options.key,
        new Date(Date.now() + options.block.durationSec * 1000),
        options.block.reason || 'Rate limit exceeded'
      )
    }
    const size =
      options.window === 'minute'
        ? 60
        : options.window === 'ten_minutes'
        ? 600
        : 3600
    const reset = windowStart + size - now
    return { ok: false, status: 429, reset, message: 'Too many requests' }
  }

  return {
    ok: true,
    remaining: Math.max(0, options.limit - current),
    reset:
      windowStart +
      (options.window === 'minute'
        ? 60
        : options.window === 'ten_minutes'
        ? 600
        : 3600) -
      now,
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
