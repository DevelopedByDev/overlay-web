import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const GCM_AUTH_TAG_LENGTH_BYTES = 16

function deriveAesKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

// Minimum length for a key after .trim(). 32 chars of hex = 128 bits of
// entropy, which is the floor we accept. Generate with `openssl rand -hex 32`.
const MIN_KEY_LENGTH = 32

function getRequiredEncryptionSecret(params: {
  primaryEnvVar: string
  legacyEnvVar?: string
  purpose: string
}): string {
  const primary = process.env[params.primaryEnvVar]?.trim()
  if (primary) {
    if (primary.length < MIN_KEY_LENGTH) {
      throw new Error(
        `${params.primaryEnvVar} is too short for ${params.purpose} (got ${primary.length} chars, need >= ${MIN_KEY_LENGTH})`,
      )
    }
    // In production, refuse to share the same secret with other domains. This
    // prevents a single leak from compromising multiple crypto domains.
    if (process.env.NODE_ENV === 'production' && params.legacyEnvVar) {
      const legacy = process.env[params.legacyEnvVar]?.trim()
      if (legacy && legacy === primary) {
        throw new Error(
          `${params.primaryEnvVar} must not equal ${params.legacyEnvVar} in production (${params.purpose})`,
        )
      }
    }
    // Disallow reuse of the internal service-auth secret for session crypto,
    // regardless of which var it came in under.
    const internalSecret = process.env['INTERNAL_API_SECRET']?.trim()
    if (internalSecret && internalSecret === primary) {
      throw new Error(
        `${params.primaryEnvVar} must not equal INTERNAL_API_SECRET (${params.purpose})`,
      )
    }
    return primary
  }

  if (process.env.NODE_ENV !== 'production' && params.legacyEnvVar) {
    const legacy = process.env[params.legacyEnvVar]?.trim()
    if (legacy && legacy.length >= MIN_KEY_LENGTH) {
      return legacy
    }
  }

  const fallbackMessage = params.legacyEnvVar && process.env.NODE_ENV !== 'production'
    ? ` or ${params.legacyEnvVar} (dev only, must be >= ${MIN_KEY_LENGTH} chars)`
    : ''
  throw new Error(`${params.primaryEnvVar} is not configured for ${params.purpose}${fallbackMessage}`)
}

function getSessionTransferKey(): Buffer {
  return deriveAesKey(
    getRequiredEncryptionSecret({
      primaryEnvVar: 'SESSION_TRANSFER_KEY',
      legacyEnvVar: 'INTERNAL_API_SECRET',
      purpose: 'session transfer encryption',
    })
  )
}

function getSessionCookieEncryptionKey(): Buffer {
  return deriveAesKey(
    getRequiredEncryptionSecret({
      primaryEnvVar: 'SESSION_COOKIE_ENCRYPTION_KEY',
      legacyEnvVar: 'SESSION_SECRET',
      purpose: 'session cookie encryption',
    })
  )
}

function encryptPayload(payload: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.')
}

function decryptPayload(payload: string, key: Buffer): string {
  const [ivSegment, encryptedSegment, authTagSegment] = payload.split('.')
  if (!ivSegment || !encryptedSegment || !authTagSegment) {
    throw new Error('Invalid encrypted session transfer payload')
  }

  const decipher = createDecipheriv(
    AES_ALGORITHM,
    key,
    Buffer.from(ivSegment, 'base64url'),
    { authTagLength: GCM_AUTH_TAG_LENGTH_BYTES },
  )
  const authTag = Buffer.from(authTagSegment, 'base64url')
  if (authTag.byteLength !== GCM_AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid encrypted session transfer auth tag')
  }
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedSegment, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptSessionTransferPayload(payload: string): string {
  return encryptPayload(payload, getSessionTransferKey())
}

export function decryptSessionTransferPayload(payload: string): string {
  return decryptPayload(payload, getSessionTransferKey())
}

export function encryptSessionCookiePayload(payload: string): string {
  return encryptPayload(payload, getSessionCookieEncryptionKey())
}

export function decryptSessionCookiePayload(payload: string): string {
  return decryptPayload(payload, getSessionCookieEncryptionKey())
}
