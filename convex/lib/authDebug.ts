const textDecoder = new TextDecoder()

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

function decodeBase64UrlToUint8Array(value: string): Uint8Array {
  const b64 = toBase64(value)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const bytes = decodeBase64UrlToUint8Array(value)
    return JSON.parse(textDecoder.decode(bytes)) as T
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
    return { present: false }
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

export function summarizeEnvResolutionForLog() {
  return {
    hasWorkOsClientId: Boolean(process.env.WORKOS_CLIENT_ID),
    hasDevWorkOsClientId: Boolean(process.env.DEV_WORKOS_CLIENT_ID),
    hasWorkOsApiKey: Boolean(process.env.WORKOS_API_KEY),
    hasDevWorkOsApiKey: Boolean(process.env.DEV_WORKOS_API_KEY),
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
    console.log(`[ConvexAuthDebug] ${label}`)
    return
  }
  console.log(`[ConvexAuthDebug] ${label}`, payload)
}
