import { getRedis } from './redis'

type WindowSize = 'minute' | 'ten_minutes' | 'hour'

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function windowSizeSeconds(window: WindowSize): number {
  return window === 'minute' ? 60 : window === 'ten_minutes' ? 600 : 3600
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
  const redis = getRedis()
  const windowSeconds = windowSizeSeconds(options.window)
  const now = nowEpochSeconds()
  const windowStart = now - (now % windowSeconds)
  const key = `rl:${options.route}:${options.key}:${windowStart}`
  const blockKey = `rlblock:${options.route}:${options.key}`

  const blockedUntil = await redis.get(blockKey)
  if (blockedUntil) {
    const until = Number(blockedUntil)
    const reset = Math.max(0, until - now)
    if (until > now) {
      return { ok: false, status: 429, reset, message: 'Too many requests' }
    }
  }

  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, windowSeconds + 1)
  }

  const reset = windowStart + windowSeconds - now

  if (current > options.limit) {
    if (options.block) {
      const untilTs = now + options.block.durationSec
      await redis.set(
        blockKey,
        String(untilTs),
        'EX',
        options.block.durationSec
      )
    }
    return { ok: false, status: 429, reset, message: 'Too many requests' }
  }

  return { ok: true, remaining: Math.max(0, options.limit - current), reset }
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
