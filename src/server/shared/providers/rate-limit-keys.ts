import 'server-only'

import { createHash } from 'node:crypto'
import type { RateLimitSpec } from '@overlay/app-core'

export function getRateLimitBucketKey(scope: string, spec: RateLimitSpec): string | null {
  const rawKey = spec.key?.trim() || scope.trim()
  if (!rawKey) return null
  const digest = createHash('sha256').update(rawKey).digest('hex')
  return `${spec.bucket}:${digest}`
}
