const WORKOS_ISSUER = 'https://api.workos.com'
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000
const textEncoder = new TextEncoder()

type WorkOSAccessTokenClaims = {
  iss: string
  sub: string
  aud: string | string[]
  exp: number
  iat?: number
  [key: string]: unknown
}

type JwtHeader = {
  alg?: string
  kid?: string
  typ?: string
}

type CachedJwks = {
  expiresAt: number
  keys: WorkOsJwk[]
}

type WorkOsJwk = JsonWebKey & {
  kid?: string
  kty?: string
}

const jwksCache = new Map<string, CachedJwks>()

function getConfiguredWorkOsClientIds(): string[] {
  return [...new Set(
    [process.env.WORKOS_CLIENT_ID, process.env.DEV_WORKOS_CLIENT_ID]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  )]
}

function normalizeAudience(aud: unknown): string[] {
  if (typeof aud === 'string') {
    return [aud]
  }
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  }
  return []
}

function selectWorkOsClientId(aud: unknown): string | null {
  const audiences = normalizeAudience(aud)
  if (audiences.length === 0) return null
  const configuredClientIds = getConfiguredWorkOsClientIds()
  if (configuredClientIds.length === 0) return null
  return configuredClientIds.find((clientId) => audiences.includes(clientId)) ?? null
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

function decodeBase64UrlArrayBuffer(value: string): ArrayBuffer {
  const buffer = Buffer.from(toBase64(value), 'base64')
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

async function fetchJwks(clientId: string, forceRefresh = false): Promise<WorkOsJwk[]> {
  const now = Date.now()
  const cached = jwksCache.get(clientId)
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.keys
  }

  const apiKey = process.env.WORKOS_API_KEY || process.env.DEV_WORKOS_API_KEY
  const response = await fetch(`https://api.workos.com/sso/jwks/${clientId}`, {
    headers: apiKey
      ? { Authorization: `Bearer ${apiKey}` }
      : undefined,
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch WorkOS JWKS: HTTP ${response.status}`)
  }

  const json = await response.json() as { keys?: WorkOsJwk[] }
  const keys = Array.isArray(json.keys) ? json.keys : []
  jwksCache.set(clientId, {
    expiresAt: now + JWKS_CACHE_TTL_MS,
    keys,
  })
  return keys
}

async function findJwk(clientId: string, kid: string): Promise<WorkOsJwk | null> {
  let keys = await fetchJwks(clientId)
  let jwk =
    keys.find((entry) => typeof entry.kid === 'string' && entry.kid === kid) ?? null
  if (jwk) return jwk

  keys = await fetchJwks(clientId, true)
  jwk = keys.find((entry) => typeof entry.kid === 'string' && entry.kid === kid) ?? null
  return jwk
}

async function verifyRs256Signature(
  signingInput: string,
  signatureSegment: string,
  jwk: WorkOsJwk,
): Promise<boolean> {
  if (jwk.kty !== 'RSA') return false
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64UrlArrayBuffer(signatureSegment),
    new TextEncoder().encode(signingInput),
  )
}

export async function getVerifiedAccessTokenClaims(
  accessToken: string,
): Promise<WorkOSAccessTokenClaims | null> {
  if (!accessToken || typeof accessToken !== 'string') return null

  const trimmed = accessToken.trim()
  const parts = trimmed.split('.')
  if (parts.length !== 3) return null

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const header = decodeBase64UrlJson<JwtHeader>(headerSegment)
  const claims = decodeBase64UrlJson<WorkOSAccessTokenClaims>(payloadSegment)
  if (!header || !claims) return null

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    return null
  }
  if (claims.iss !== WORKOS_ISSUER) return null
  if (typeof claims.sub !== 'string' || !claims.sub.trim()) return null
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null

  const clientId = selectWorkOsClientId(claims.aud)
  if (!clientId) return null

  const jwk = await findJwk(clientId, header.kid)
  if (!jwk) return null

  const verified = await verifyRs256Signature(
    `${headerSegment}.${payloadSegment}`,
    signatureSegment,
    jwk,
  )
  return verified ? claims : null
}

export async function validateAccessToken(accessToken: string): Promise<boolean> {
  return (await getVerifiedAccessTokenClaims(accessToken)) !== null
}

export async function requireAccessToken(
  accessToken: string,
  userId?: string,
): Promise<WorkOSAccessTokenClaims> {
  const claims = await getVerifiedAccessTokenClaims(accessToken)
  if (!claims) {
    throw new Error('Unauthorized')
  }
  if (userId && claims.sub !== userId) {
    throw new Error('Unauthorized')
  }
  return claims
}

export function constantTimeEqualStrings(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) {
    return false
  }

  const leftBytes = textEncoder.encode(left)
  const rightBytes = textEncoder.encode(right)
  const maxLength = Math.max(leftBytes.length, rightBytes.length)

  let diff = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }

  return diff === 0
}

export function validateServerSecret(secret: string | undefined): boolean {
  const expected = process.env.INTERNAL_API_SECRET?.trim()
  const provided = secret?.trim()
  if (!expected || !provided) return false

  return constantTimeEqualStrings(expected, provided)
}

export function requireServerSecret(secret: string | undefined): void {
  if (!validateServerSecret(secret)) {
    throw new Error('Unauthorized')
  }
}
