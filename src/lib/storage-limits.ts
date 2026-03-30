export type OverlayTier = 'free' | 'pro' | 'max'

export const OVERLAY_STORAGE_BYTES_LIMITS: Record<OverlayTier, number> = {
  free: 10 * 1024 * 1024,
  pro: 1024 * 1024 * 1024,
  max: 10 * 1024 * 1024 * 1024,
}

export function getOverlayStorageBytesLimit(tier: OverlayTier): number {
  return OVERLAY_STORAGE_BYTES_LIMITS[tier]
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIdx = 0
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024
    unitIdx += 1
  }
  const precision = value >= 100 || unitIdx === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[unitIdx]}`
}
