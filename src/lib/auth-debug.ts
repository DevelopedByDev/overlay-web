type JwtHeader = {
  alg?: unknown
  kid?: unknown
  typ?: unknown
}

type JwtPayload = {
  iss?: unknown
  sub?: unknown
  aud?: unknown
  exp?: unknown
  iat?: unknown
  [key: string]: unknown
}

function toBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  if (pad === 0) return normalized
  return normalized + '='.repeat(4 - pad)
}

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(toBase64(value), 'base64').toString('utf-8')) as T
  } catch {
    return null
  }
}

function maskString(value: string | null | undefined, start = 8, end = 6): string | null {
  if (!value) return null
  if (value.length <= start + end) return value
  return `${value.slice(0, start)}…${value.slice(-end)}`
}

function normalizeAudience(aud: unknown): string[] {
  if (typeof aud === 'string') return [aud]
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }
  return []
}

export function summarizeJwtForLog(token: string | null | undefined) {
  if (!token) {
    return {
      present: false,
    }
  }

  const trimmed = token.trim()
  const parts = trimmed.split('.')
  const header = parts.length === 3 ? decodeBase64UrlJson<JwtHeader>(parts[0]!) : null
  const payload = parts.length === 3 ? decodeBase64UrlJson<JwtPayload>(parts[1]!) : null
  const expMs = typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  const iatMs = typeof payload?.iat === 'number' ? payload.iat * 1000 : null

  return {
    present: true,
    length: trimmed.length,
    preview: maskString(trimmed),
    parts: parts.length,
    header: {
      alg: typeof header?.alg === 'string' ? header.alg : null,
      kid: typeof header?.kid === 'string' ? header.kid : null,
      typ: typeof header?.typ === 'string' ? header.typ : null,
    },
    claims: {
      iss: typeof payload?.iss === 'string' ? payload.iss : null,
      sub: typeof payload?.sub === 'string' ? payload.sub : null,
      aud: normalizeAudience(payload?.aud),
      exp: typeof payload?.exp === 'number' ? payload.exp : null,
      expIso: expMs ? new Date(expMs).toISOString() : null,
      expired: expMs ? expMs <= Date.now() : null,
      iat: typeof payload?.iat === 'number' ? payload.iat : null,
      iatIso: iatMs ? new Date(iatMs).toISOString() : null,
    },
  }
}

export function summarizeOpaqueTokenForLog(token: string | null | undefined) {
  return {
    present: Boolean(token),
    length: token?.length ?? 0,
    preview: maskString(token),
  }
}

export function summarizeSessionForLog(
  session:
    | {
        accessToken?: string
        refreshToken?: string
        user?: {
          id?: string
          email?: string
          firstName?: string
          lastName?: string
          emailVerified?: boolean
        }
        expiresAt?: number
      }
    | null
    | undefined,
) {
  if (!session) {
    return { present: false }
  }

  return {
    present: true,
    user: {
      id: session.user?.id ?? null,
      email: session.user?.email ?? null,
      firstName: session.user?.firstName ?? null,
      lastName: session.user?.lastName ?? null,
      emailVerified: session.user?.emailVerified ?? null,
    },
    expiresAt: typeof session.expiresAt === 'number' ? session.expiresAt : null,
    expiresAtIso:
      typeof session.expiresAt === 'number' ? new Date(session.expiresAt).toISOString() : null,
    accessToken: summarizeJwtForLog(session.accessToken),
    refreshToken: summarizeOpaqueTokenForLog(session.refreshToken),
  }
}

export function summarizeEnvResolutionForLog() {
  return {
    nodeEnv: process.env.NODE_ENV ?? null,
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasWorkOsClientId: Boolean(process.env.WORKOS_CLIENT_ID),
    hasDevWorkOsClientId: Boolean(process.env.DEV_WORKOS_CLIENT_ID),
    hasWorkOsApiKey: Boolean(process.env.WORKOS_API_KEY),
    hasDevWorkOsApiKey: Boolean(process.env.DEV_WORKOS_API_KEY),
    hasNextPublicConvexUrl: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
    hasDevNextPublicConvexUrl: Boolean(process.env.DEV_NEXT_PUBLIC_CONVEX_URL),
    workOsClientIdPreview: maskString(process.env.WORKOS_CLIENT_ID ?? null),
    devWorkOsClientIdPreview: maskString(process.env.DEV_WORKOS_CLIENT_ID ?? null),
  }
}

function shouldLogAuthDebug(): boolean {
  return process.env.AUTH_DEBUG === '1' && process.env.NODE_ENV !== 'production'
}

export function logAuthDebug(label: string, payload?: unknown) {
  if (!shouldLogAuthDebug()) {
    return
  }
  if (payload === undefined) {
    console.log(`[AuthDebug] ${label}`)
    return
  }
  console.log(`[AuthDebug] ${label}`, payload)
}
