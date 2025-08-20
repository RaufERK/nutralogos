import Redis from 'ioredis'

let client: Redis | null = null

export const getRedis = (): Redis => {
  if (!client) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL is not set')
    client = new Redis(url)
  }
  return client
}

export const throttle = async (
  key: string,
  minIntervalMs: number
): Promise<void> => {
  const redis = getRedis()
  const namespaced = `throttle:${key}`
  for (let i = 0; i < 20; i += 1) {
    const set = await redis.set(namespaced, '1', 'PX', minIntervalMs, 'NX')
    if (set === 'OK') return
    const ttl = await redis.pttl(namespaced)
    const waitMs =
      typeof ttl === 'number' && ttl > 0 ? ttl : Math.min(minIntervalMs, 200)
    await new Promise((r) => setTimeout(r, waitMs))
  }
}
