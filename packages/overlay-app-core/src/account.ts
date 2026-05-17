import type { Entitlements } from './contracts'

export interface EntitlementMeterViewModel {
  usedCents: number
  totalCents: number
  remainingCents: number
  percentUsed: number
  isPaid: boolean
  isExhausted: boolean
}

export function entitlementMeterViewModel(entitlements: Entitlements | null): EntitlementMeterViewModel {
  const isPaid = (entitlements?.planKind ?? (entitlements?.tier === 'free' ? 'free' : 'paid')) === 'paid'
  const totalCents = entitlements
    ? (entitlements.budgetTotalCents ?? Math.max(0, Math.round((entitlements.creditsTotal ?? 0) * 100)))
    : 0
  const usedCents = entitlements
    ? (entitlements.budgetUsedCents ?? Math.max(0, Math.round(entitlements.creditsUsed ?? 0)))
    : 0
  const remainingCents = entitlements
    ? (entitlements.budgetRemainingCents ?? Math.max(0, totalCents - usedCents))
    : 0
  const percentUsed = totalCents > 0 ? Math.min(100, Math.max(0, (usedCents / totalCents) * 100)) : 0
  return {
    usedCents,
    totalCents,
    remainingCents,
    percentUsed,
    isPaid,
    isExhausted: isPaid && remainingCents <= 0,
  }
}

export function isValidPkceChallenge(value: string | null | undefined): boolean {
  const challenge = value?.trim()
  return Boolean(challenge && /^[A-Za-z0-9._~-]{43,128}$/.test(challenge))
}
