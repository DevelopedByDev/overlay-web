/** Stable idempotency key for POST /api/v1/conversations/act stream starts (5.5). */
export function buildActStreamIdempotencyKey(turnId: string, slotIndex = 0): string {
  const trimmed = turnId.trim()
  if (!trimmed) {
    throw new Error('turnId is required for act stream idempotency')
  }
  const slot = Number.isFinite(slotIndex) && slotIndex >= 0 ? Math.floor(slotIndex) : 0
  return `act:${trimmed}:${slot}`
}

export function parseActStreamIdempotencyKey(key: string): { turnId: string; slotIndex: number } | null {
  const match = /^act:([^:]+):(\d+)$/.exec(key.trim())
  if (!match) return null
  return { turnId: match[1], slotIndex: Number(match[2]) }
}

/** Worker fallback when the browser header is missing — must match buildActStreamIdempotencyKey. */
export function buildActStreamIdempotencyKeyFromMetadata(
  turnId: string,
  variantIndex: number,
): string {
  return buildActStreamIdempotencyKey(turnId, variantIndex)
}
