import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { logSecurityEvent } from '@/lib/security-events'

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

type RateLimitTakeResult = {
  bucket: string
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

type NormalizedRateLimitRule = {
  bucket: string
  bucketKey: string
  limit: number
  windowMs: number
}

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
  return `${rule.bucket}:${createHash('sha256').update(key).digest('hex')}`
}

export function getClientIp(request: NextRequest): string {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return vercelForwarded || cloudflareIp || forwarded || realIp || 'unknown'
}

function takeRateLimitLocal(rule: RateLimitRule): RateLimitTakeResult {
  const now = Date.now()
  cleanupExpired(now)

  const bucketKey = getBucketKey(rule)
  if (!bucketKey) {
    return { bucket: rule.bucket, allowed: true, remaining: rule.limit, retryAfterSeconds: 0 }
  }

  const existing = rateLimitStore.get(bucketKey)
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, { count: 1, resetAt: now + rule.windowMs })
    return {
      bucket: rule.bucket,
      allowed: true,
      remaining: Math.max(0, rule.limit - 1),
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    }
  }

  if (existing.count >= rule.limit) {
    return {
      bucket: rule.bucket,
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  rateLimitStore.set(bucketKey, existing)
  return {
    bucket: rule.bucket,
    allowed: true,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

async function takeRateLimits(rules: RateLimitRule[]): Promise<RateLimitTakeResult[]> {
  const results = rules.map<RateLimitTakeResult>((rule) => ({
    bucket: rule.bucket,
    allowed: true,
    remaining: rule.limit,
    retryAfterSeconds: 0,
  }))

  const normalizedRules: Array<{
    originalIndex: number
    rule: NormalizedRateLimitRule
  }> = []

  for (const [index, rule] of rules.entries()) {
    const bucketKey = getBucketKey(rule)
    if (!bucketKey) continue
    normalizedRules.push({
      originalIndex: index,
      rule: {
        bucket: rule.bucket,
        bucketKey,
        limit: rule.limit,
        windowMs: rule.windowMs,
      },
    })
  }

  if (normalizedRules.length === 0) {
    return results
  }

  try {
    const backendResults = await convex.mutation<RateLimitTakeResult[]>('rateLimits:takeManyByServer', {
      serverSecret: getInternalApiSecret(),
      rules: normalizedRules.map(({ rule }) => rule),
    }, {
      throwOnError: true,
      timeoutMs: 10_000,
      suppressNetworkConsoleError: true,
    })

    if (backendResults && backendResults.length === normalizedRules.length) {
      for (const [index, result] of backendResults.entries()) {
        const originalIndex = normalizedRules[index]?.originalIndex
        if (originalIndex == null) continue
        results[originalIndex] = result
      }
      return results
    }
  } catch (error) {
    logSecurityEvent('rate_limit_backend_fallback', {
      reason: error instanceof Error ? error.message : String(error),
    }, 'warning')
  }

  return rules.map((rule) => takeRateLimitLocal(rule))
}

export async function rateLimitByIp(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  return enforceRateLimits(request, [
    { bucket, key: getClientIp(request), limit, windowMs },
  ])
}

export async function enforceRateLimits(
  request: NextRequest,
  rules: RateLimitRule[],
): Promise<NextResponse | null> {
  const results = await takeRateLimits(rules)

  for (const [index, rule] of rules.entries()) {
    const result = results[index]
    if (!result) continue
    if (result.allowed) continue

    logSecurityEvent('rate_limit_blocked', {
      bucket: rule.bucket,
      keyHash: getBucketKey(rule),
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
