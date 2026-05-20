import 'server-only'

import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitResult,
  RateLimitSpec,
} from '@overlay/app-core'
import { InMemoryRateLimiter } from './in-memory-rate-limiter'
import { getRateLimitBucketKey } from './rate-limit-keys'

type UpstashPipelineEntry = {
  result?: unknown
  error?: string
}

function readRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

function numberResult(entry: UpstashPipelineEntry | undefined): number | null {
  const value = entry?.result
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export class RedisRateLimiter implements RateLimiter {
  private readonly fallback: RateLimiter

  constructor(fallback: RateLimiter = new InMemoryRateLimiter()) {
    this.fallback = fallback
  }

  async check(scope: string, limits: RateLimitSpec[]): Promise<RateLimitResult> {
    const config = readRedisConfig()
    if (!config) {
      return this.fallback.check(scope, limits)
    }

    const now = Date.now()
    const decisions: RateLimitDecision[] = []

    try {
      for (const limit of limits) {
        const bucketKey = getRateLimitBucketKey(scope, limit)
        if (!bucketKey) {
          decisions.push({
            bucket: limit.bucket,
            allowed: true,
            remaining: limit.limit,
            retryAfterSeconds: 0,
          })
          continue
        }

        const redisKey = `overlay:rate-limit:${bucketKey}`
        const response = await fetch(`${config.url}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            ['INCR', redisKey],
            ['PEXPIRE', redisKey, String(limit.windowMs), 'NX'],
            ['PTTL', redisKey],
          ]),
        })

        if (!response.ok) {
          throw new Error(`Redis rate limit request failed with HTTP ${response.status}`)
        }

        const payload = (await response.json()) as UpstashPipelineEntry[]
        const count = numberResult(payload[0]) ?? 1
        const ttlMs = Math.max(0, numberResult(payload[2]) ?? limit.windowMs)
        const allowed = count <= limit.limit
        decisions.push({
          bucket: limit.bucket,
          allowed,
          remaining: allowed ? Math.max(0, limit.limit - count) : 0,
          retryAfterSeconds: ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0,
          resetAt: now + ttlMs,
        })
      }
    } catch {
      return this.fallback.check(scope, limits)
    }

    return {
      allowed: decisions.every((decision) => decision.allowed),
      retryAfterSeconds: Math.max(0, ...decisions.map((decision) => decision.retryAfterSeconds)),
      decisions,
    }
  }
}
