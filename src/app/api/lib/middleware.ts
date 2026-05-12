// @enterprise-future — not wired to production
// Composable API route middleware for Next.js Route Handlers.
// Usage: export const GET = createHandler([withAuth, withAdmin], async (req, ctx) => { ... })

import { NextResponse } from 'next/server'
import { getSession, type AuthSession, type AuthUser } from '@/lib/workos-auth'
import { requireAdmin, type AdminAuthResult } from '@/lib/admin-auth'
import { logAuditEvent, type AuditEvent } from '@/lib/audit'
import { createHash } from 'node:crypto'
import type { z } from 'zod'
import { getConfig } from '@/lib/config/singleton'

type Middleware = (
  req: Request,
  ctx: HandlerContext,
) => Promise<Response | void>

export interface HandlerContext {
  user: AuthUser | null
  session: AuthSession | null
  adminResult: AdminAuthResult | null
  auditBase: Omit<AuditEvent, 'id' | 'timestamp'>
  body?: unknown
  query?: unknown
}

export interface CreateHandlerOptions {
  middleware?: Middleware[]
  body?: z.ZodType
  query?: z.ZodType
}

function createBaseContext(): HandlerContext {
  return {
    user: null,
    session: null,
    adminResult: null,
    auditBase: {
      actorId: 'system',
      actorType: 'system',
      action: 'unknown',
      resource: 'api',
    },
  }
}

export function createHandler(
  options: CreateHandlerOptions,
  handler: (req: Request, ctx: HandlerContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  const chain = options.middleware ?? []

  return async (req: Request) => {
    const ctx = createBaseContext()
    let response: Response | undefined

    for (const mw of chain) {
      const result = await mw(req, ctx)
      if (result instanceof Response) {
        response = result
        break
      }
    }

    if (response) {
      return response
    }

    try {
      if (options.query) {
        ctx.query = options.query.parse(Object.fromEntries(new URL(req.url).searchParams.entries()))
      }
      if (options.body) {
        const contentType = req.headers.get('content-type') || ''
        const payload = contentType.includes('application/json') ? await req.json() : {}
        ctx.body = options.body.parse(payload)
      }
      return await handler(req, ctx)
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error) {
        return NextResponse.json(
          { error: 'Invalid request', details: (error as { issues: unknown }).issues },
          { status: 400 },
        )
      }
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[API] ${req.method} ${req.url} error:`, message)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

export function createValidatedHandler<TBody, TQuery>(
  schemas: { body?: z.ZodType<TBody>; query?: z.ZodType<TQuery> } = {},
  handler: (
    req: Request,
    parsed: { body?: TBody; query?: TQuery },
    ctx: HandlerContext,
  ) => Promise<Response>,
  options: Omit<CreateHandlerOptions, 'body' | 'query'> = {},
): (req: Request) => Promise<Response> {
  return createHandler(
    { ...options, body: schemas.body, query: schemas.query },
    (req, ctx) => handler(req, { body: ctx.body as TBody | undefined, query: ctx.query as TQuery | undefined }, ctx),
  )
}

// ─── Middleware pieces ───────────────────────────────────────────────

/** Resolve session from cookie; attach user to context. Return 401 if auth is required. */
export const withAuth: Middleware = async (_req, ctx) => {
  const session = await getSession()
  if (session) {
    ctx.session = session
    ctx.user = session.user
    ctx.auditBase = {
      ...ctx.auditBase,
      actorId: session.user.id,
      actorType: 'user',
    }
  }
}

/** Require a valid session; return 401 otherwise. */
export const withRequireAuth: Middleware = async (_req, ctx) => {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  ctx.session = session
  ctx.user = session.user
  ctx.auditBase = {
    ...ctx.auditBase,
    actorId: session.user.id,
    actorType: 'user',
  }
}

/** Require admin access; return 403 otherwise. Must be used after withRequireAuth. */
export const withAdmin: Middleware = async (_req, ctx) => {
  const result = await requireAdmin()
  ctx.adminResult = result
  if (!result.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

/** Log an audit event on completion. Best-effort; never throws. */
export const withAudit: Middleware = async (req, ctx) => {
  // Attach request metadata so the handler can enrich the audit base
  const url = new URL(req.url)
  ctx.auditBase = {
    ...ctx.auditBase,
    action: `${req.method.toLowerCase()}_${url.pathname.replace(/\//g, '_')}`,
    resource: url.pathname,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get('user-agent') ?? undefined,
  }
}

// ─── Rate limit helpers ──────────────────────────────────────────────

type RateLimitWindow = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitWindow>()

function cleanupExpired(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

function getBucketKey(bucket: string, key: string): string {
  return `${bucket}:${createHash('sha256').update(key).digest('hex')}`
}

export function takeRateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now()
  cleanupExpired(now)

  const bucketKey = getBucketKey(bucket, key)
  const existing = rateLimitStore.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  if (existing.count >= limit) {
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
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/** Rate-limit by IP. Return 429 if exceeded. */
export function withRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Middleware {
  return async (req) => {
    const ip = getClientIp(req)
    const result = takeRateLimit(bucket, ip, limit, windowMs)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSeconds: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSeconds),
            'Cache-Control': 'no-store',
          },
        },
      )
    }
  }
}

// ─── Utilities ─────────────────────────────────────────────────────

export function getClientIp(req: Request): string {
  const config = getConfig()
  const trustProxyHeaders =
    config.deployment.trustProxyHeaders ||
    Boolean(process.env.VERCEL || process.env.CF_PAGES || process.env.CLOUDFLARE_ACCOUNT_ID)
  if (!trustProxyHeaders) return 'unknown'

  const candidates = [
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim(),
    req.headers.get('cf-connecting-ip')?.trim(),
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    req.headers.get('x-real-ip')?.trim(),
  ]
  return candidates.find((value) => Boolean(value)) || 'unknown'
}

/** Convenience: log an audit event using the handler context. */
export function auditLog(ctx: HandlerContext, overrides: Partial<Omit<AuditEvent, 'id' | 'timestamp'>>): void {
  logAuditEvent({ ...ctx.auditBase, ...overrides })
}
