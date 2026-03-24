import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12

function getSessionTransferKey(): Buffer {
  return createHash('sha256').update(getInternalApiSecret()).digest()
}

export function encryptSessionTransferPayload(payload: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(AES_ALGORITHM, getSessionTransferKey(), iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.')
}

export function decryptSessionTransferPayload(payload: string): string {
  const [ivSegment, encryptedSegment, authTagSegment] = payload.split('.')
  if (!ivSegment || !encryptedSegment || !authTagSegment) {
    throw new Error('Invalid encrypted session transfer payload')
  }

  const decipher = createDecipheriv(
    AES_ALGORITHM,
    getSessionTransferKey(),
    Buffer.from(ivSegment, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(authTagSegment, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedSegment, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
