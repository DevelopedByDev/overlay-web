import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

type RateLimitWindow = {
  count: number
  resetAt: number
}

type RateLimitRule = {
  bucket: string
  key: string | null | undefined
  limit: number
  windowMs: number
}

const rateLimitStore = new Map<string, RateLimitWindow>()

function cleanupExpired(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

function getBucketKey(rule: RateLimitRule): string | null {
  const key = rule.key?.trim()
  if (!key) return null
  return `${rule.bucket}:${key}`
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwarded || realIp || 'unknown'
}

function takeRateLimit(rule: RateLimitRule): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now()
  cleanupExpired(now)

  const bucketKey = getBucketKey(rule)
  if (!bucketKey) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 }
  }

  const existing = rateLimitStore.get(bucketKey)
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, { count: 1, resetAt: now + rule.windowMs })
    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - 1),
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    }
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  rateLimitStore.set(bucketKey, existing)
  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

export function rateLimitByIp(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  return enforceRateLimits(request, [
    { bucket, key: getClientIp(request), limit, windowMs },
  ])
}

export function enforceRateLimits(
  request: NextRequest,
  rules: RateLimitRule[],
): NextResponse | null {
  for (const rule of rules) {
    const result = takeRateLimit(rule)
    if (result.allowed) continue

    console.warn('[RateLimit] blocked request', {
      bucket: rule.bucket,
      key: rule.key,
      path: request.nextUrl.pathname,
      method: request.method,
      retryAfterSeconds: result.retryAfterSeconds,
    })

    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfterSeconds: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return null
}
