import 'server-only'

import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitResult,
  RateLimitSpec,
} from '@overlay/app-core'
import { getRateLimitBucketKey } from './rate-limit-keys'

type RateLimitWindow = {
  count: number
  resetAt: number
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, RateLimitWindow>()

  async check(scope: string, limits: RateLimitSpec[]): Promise<RateLimitResult> {
    const now = Date.now()
    this.cleanupExpired(now)
    const decisions = limits.map((limit) => this.take(scope, limit, now))
    return {
      allowed: decisions.every((decision) => decision.allowed),
      retryAfterSeconds: Math.max(0, ...decisions.map((decision) => decision.retryAfterSeconds)),
      decisions,
    }
  }

  private cleanupExpired(now: number): void {
    for (const [key, value] of this.store.entries()) {
      if (value.resetAt <= now) {
        this.store.delete(key)
      }
    }
  }

  private take(scope: string, limit: RateLimitSpec, now: number): RateLimitDecision {
    const bucketKey = getRateLimitBucketKey(scope, limit)
    if (!bucketKey) {
      return {
        bucket: limit.bucket,
        allowed: true,
        remaining: limit.limit,
        retryAfterSeconds: 0,
      }
    }

    const existing = this.store.get(bucketKey)
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + limit.windowMs
      this.store.set(bucketKey, { count: 1, resetAt })
      return {
        bucket: limit.bucket,
        allowed: true,
        remaining: Math.max(0, limit.limit - 1),
        retryAfterSeconds: Math.ceil(limit.windowMs / 1000),
        resetAt,
      }
    }

    if (existing.count >= limit.limit) {
      return {
        bucket: limit.bucket,
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        resetAt: existing.resetAt,
      }
    }

    existing.count += 1
    this.store.set(bucketKey, existing)
    return {
      bucket: limit.bucket,
      allowed: true,
      remaining: Math.max(0, limit.limit - existing.count),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      resetAt: existing.resetAt,
    }
  }
}
