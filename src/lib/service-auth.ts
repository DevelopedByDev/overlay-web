const SERVICE_AUTH_HEADER = 'x-overlay-service-auth'
const SERVICE_AUTH_AUDIENCE = 'overlay-internal-api'
const SERVICE_AUTH_ISSUER = 'overlay-nextjs'
const DEFAULT_SERVICE_AUTH_TTL_MS = 60_000
const MAX_SERVICE_AUTH_CLOCK_SKEW_MS = 60_000
const MAX_SERVICE_AUTH_VERIFICATIONS_PER_TOKEN = 2
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

type ServiceAuthPayload = {
  aud: string
  exp: number
  iat: number
  iss: string
  jti: string
  method: string
  path: string
  sub: string
}

function getServiceAuthSecret(): string {
  const dedicatedSecret = process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim()
  const rootSecret = process.env.INTERNAL_API_SECRET?.trim()

  if (dedicatedSecret) {
    if (process.env.NODE_ENV === 'production' && dedicatedSecret === rootSecret) {
      throw new Error('INTERNAL_SERVICE_AUTH_SECRET must not equal INTERNAL_API_SECRET in production')
    }
    return dedicatedSecret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTERNAL_SERVICE_AUTH_SECRET is required in production')
  }
  if (!rootSecret) {
    throw new Error('INTERNAL_SERVICE_AUTH_SECRET or INTERNAL_API_SECRET is not configured')
  }
  return rootSecret
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toBase64Url(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value))
}

function fromBase64Url(value: string): string {
  return textDecoder.decode(base64UrlToBytes(value))
}

let signingKeyPromise: Promise<CryptoKey> | null = null

async function getSigningKey(): Promise<CryptoKey> {
  if (!signingKeyPromise) {
    signingKeyPromise = crypto.subtle.importKey(
      'raw',
      textEncoder.encode(getServiceAuthSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
  }

  return signingKeyPromise
}

function normalizeMethod(method: string): string {
  return method.trim().toUpperCase()
}

function normalizePath(path: string): string {
  return path.trim() || '/'
}

function isValidServiceAuthPayload(value: unknown): value is ServiceAuthPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<ServiceAuthPayload>
  return (
    payload.aud === SERVICE_AUTH_AUDIENCE &&
    payload.iss === SERVICE_AUTH_ISSUER &&
    typeof payload.jti === 'string' &&
    payload.jti.trim().length > 0 &&
    typeof payload.sub === 'string' &&
    payload.sub.trim().length > 0 &&
    typeof payload.method === 'string' &&
    payload.method.trim().length > 0 &&
    typeof payload.path === 'string' &&
    payload.path.trim().length > 0 &&
    typeof payload.iat === 'number' &&
    Number.isFinite(payload.iat) &&
    typeof payload.exp === 'number' &&
    Number.isFinite(payload.exp)
  )
}

export function getServiceAuthHeaderName(): string {
  return SERVICE_AUTH_HEADER
}

type SeenServiceAuthToken = {
  count: number
  expiresAt: number
}

const seenServiceAuthTokens = new Map<string, SeenServiceAuthToken>()

function cleanupSeenServiceAuthTokens(now: number): void {
  for (const [jti, record] of seenServiceAuthTokens.entries()) {
    if (record.expiresAt <= now) {
      seenServiceAuthTokens.delete(jti)
    }
  }
}

function recordServiceAuthVerification(jti: string, expiresAt: number): boolean {
  const now = Date.now()
  cleanupSeenServiceAuthTokens(now)

  const existing = seenServiceAuthTokens.get(jti)
  if (existing) {
    if (existing.count >= MAX_SERVICE_AUTH_VERIFICATIONS_PER_TOKEN) {
      return false
    }
    existing.count += 1
    existing.expiresAt = Math.max(existing.expiresAt, expiresAt)
    seenServiceAuthTokens.set(jti, existing)
    return true
  }

  seenServiceAuthTokens.set(jti, {
    count: 1,
    expiresAt,
  })
  return true
}

export async function buildServiceAuthToken(params: {
  userId: string
  method: string
  path: string
  ttlMs?: number
}): Promise<string> {
  const now = Date.now()
  const payload: ServiceAuthPayload = {
    aud: SERVICE_AUTH_AUDIENCE,
    iss: SERVICE_AUTH_ISSUER,
    jti: crypto.randomUUID(),
    sub: params.userId.trim(),
    method: normalizeMethod(params.method),
    path: normalizePath(params.path),
    iat: now,
    exp: now + Math.max(1_000, params.ttlMs ?? DEFAULT_SERVICE_AUTH_TTL_MS),
  }
  const payloadSegment = toBase64Url(JSON.stringify(payload))
  const signingKey = await getSigningKey()
  const signature = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    textEncoder.encode(payloadSegment),
  )

  return `${payloadSegment}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifyServiceAuthToken(
  token: string | null | undefined,
  params: {
    method: string
    path: string
    userId?: string | null
  },
): Promise<{ userId: string } | null> {
  const trimmed = token?.trim()
  if (!trimmed) {
    console.error('[service-auth] verify failed: missing token')
    return null
  }

  const separatorIndex = trimmed.lastIndexOf('.')
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    console.error('[service-auth] verify failed: malformed token (no separator)')
    return null
  }

  const payloadSegment = trimmed.slice(0, separatorIndex)
  const signatureSegment = trimmed.slice(separatorIndex + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64Url(payloadSegment))
  } catch {
    console.error('[service-auth] verify failed: payload JSON parse error')
    return null
  }

  if (!isValidServiceAuthPayload(parsed)) {
    console.error('[service-auth] verify failed: invalid payload shape', { parsed })
    return null
  }

  const payload = parsed
  const signingKey = await getSigningKey()
  const signatureBytes = base64UrlToBytes(signatureSegment)
  const verified = await crypto.subtle.verify(
    'HMAC',
    signingKey,
    signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength,
    ) as ArrayBuffer,
    textEncoder.encode(payloadSegment),
  )
  if (!verified) {
    console.error('[service-auth] verify failed: HMAC signature mismatch (secrets may differ between environments)')
    return null
  }

  const now = Date.now()
  if (payload.exp < now) {
    console.error('[service-auth] verify failed: token expired', { exp: payload.exp, now })
    return null
  }
  if (payload.iat > now + MAX_SERVICE_AUTH_CLOCK_SKEW_MS) {
    console.error('[service-auth] verify failed: token issued in future (clock skew)', { iat: payload.iat, now, skewMs: payload.iat - now })
    return null
  }
  if (payload.method !== normalizeMethod(params.method)) {
    console.error('[service-auth] verify failed: method mismatch', { expected: normalizeMethod(params.method), actual: payload.method })
    return null
  }
  if (payload.path !== normalizePath(params.path)) {
    console.error('[service-auth] verify failed: path mismatch', { expected: normalizePath(params.path), actual: payload.path })
    return null
  }
  if (params.userId && payload.sub !== params.userId.trim()) {
    console.error('[service-auth] verify failed: userId mismatch', { expected: params.userId.trim(), actual: payload.sub })
    return null
  }
  if (!recordServiceAuthVerification(payload.jti, payload.exp)) {
    console.error('[service-auth] verify failed: replay protection triggered for jti', payload.jti)
    return null
  }

  return { userId: payload.sub }
}
