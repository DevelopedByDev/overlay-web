// @overlay/core — extracted from src/lib/native-refresh-rate-limit.ts
// Pure rate-limit key derivation for native auth refresh tokens.

import { createHash } from 'node:crypto'

export function getNativeRefreshTokenBucketKey(refreshToken: unknown, fallbackKey: string) {
  const token = typeof refreshToken === 'string' ? refreshToken.trim() : ''
  if (!token) return `missing:${fallbackKey}`
  return createHash('sha256').update(token).digest('hex').slice(0, 32)
}
