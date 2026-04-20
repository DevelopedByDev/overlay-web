const textEncoder = new TextEncoder()

let signingKeyPromise: Promise<CryptoKey | null> | null = null

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) {
    return null
  }

  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }
  return bytes
}

async function getSigningKey(): Promise<CryptoKey | null> {
  if (!signingKeyPromise) {
    const secret = process.env.SESSION_SECRET?.trim()
    signingKeyPromise = secret
      ? crypto.subtle.importKey(
          'raw',
          textEncoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        )
      : Promise.resolve(null)
  }
  return signingKeyPromise
}

export async function hasValidSessionCookieSignature(cookieValue: string | null | undefined): Promise<boolean> {
  const trimmed = cookieValue?.trim()
  if (!trimmed) return false

  const separatorIndex = trimmed.lastIndexOf('.')
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return false
  }

  const payload = trimmed.slice(0, separatorIndex)
  const providedSignature = trimmed.slice(separatorIndex + 1)
  const signatureBytes = hexToBytes(providedSignature)
  if (!signatureBytes) return false

  const key = await getSigningKey()
  if (!key) return false

  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(payload),
  )

  const expectedBytes = new Uint8Array(expectedSignature)
  if (expectedBytes.length !== signatureBytes.length) return false

  let diff = 0
  for (let index = 0; index < expectedBytes.length; index += 1) {
    diff |= expectedBytes[index]! ^ signatureBytes[index]!
  }

  return diff === 0
}
