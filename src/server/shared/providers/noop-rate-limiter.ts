import 'server-only'

import type {
  RateLimiter,
  RateLimitResult,
  RateLimitSpec,
} from '@overlay/app-core'

export class NoOpRateLimiter implements RateLimiter {
  async check(scope: string, limits: RateLimitSpec[]): Promise<RateLimitResult> {
    void scope
    return {
      allowed: true,
      retryAfterSeconds: 0,
      decisions: limits.map((limit) => ({
        bucket: limit.bucket,
        allowed: true,
        remaining: limit.limit,
        retryAfterSeconds: 0,
      })),
    }
  }
}
