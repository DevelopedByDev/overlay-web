const SERVICE_AUTH_HEADER = 'x-overlay-service-auth'
const SERVICE_AUTH_AUDIENCE = 'overlay-internal-api'
const DEFAULT_SERVICE_AUTH_TTL_MS = 60_000
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

type ServiceAuthPayload = {
  aud: string
  exp: number
  iat: number
  method: string
  path: string
  sub: string
}

function getServiceAuthSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }
  return secret
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

export async function buildServiceAuthToken(params: {
  userId: string
  method: string
  path: string
  ttlMs?: number
}): Promise<string> {
  const now = Date.now()
  const payload: ServiceAuthPayload = {
    aud: SERVICE_AUTH_AUDIENCE,
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
  if (!trimmed) return null

  const separatorIndex = trimmed.lastIndexOf('.')
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null
  }

  const payloadSegment = trimmed.slice(0, separatorIndex)
  const signatureSegment = trimmed.slice(separatorIndex + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64Url(payloadSegment))
  } catch {
    return null
  }

  if (!isValidServiceAuthPayload(parsed)) {
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
  if (!verified) return null

  if (payload.exp < Date.now()) return null
  if (payload.method !== normalizeMethod(params.method)) return null
  if (payload.path !== normalizePath(params.path)) return null
  if (params.userId && payload.sub !== params.userId.trim()) return null

  return { userId: payload.sub }
}
