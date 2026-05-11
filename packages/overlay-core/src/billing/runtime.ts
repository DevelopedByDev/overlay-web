// @overlay/core — extracted from src/lib/billing-runtime.ts
// Pure billing runtime helpers. Zero framework dependencies.

import {
  applyMarkupToCents,
  applyMarkupToDollars,
  centsToDollarAmount,
} from './pricing'

export interface EntitlementsSnapshot {
  tier?: string | null
  planKind?: string | null
  creditsUsed?: number
  creditsTotal?: number
  budgetUsedCents?: number | null
  budgetTotalCents?: number | null
  budgetRemainingCents?: number | null
}

export function isPaidPlan(entitlements: Pick<EntitlementsSnapshot, 'tier' | 'planKind'>): boolean {
  if (entitlements.planKind) return entitlements.planKind === 'paid'
  return entitlements.tier !== 'free'
}

export function getBudgetTotals(entitlements: EntitlementsSnapshot) {
  const usedCents =
    typeof entitlements.budgetUsedCents === 'number'
      ? entitlements.budgetUsedCents
      : Math.max(0, Math.round(entitlements.creditsUsed ?? 0))
  const totalCents =
    typeof entitlements.budgetTotalCents === 'number'
      ? entitlements.budgetTotalCents
      : Math.max(0, Math.round((entitlements.creditsTotal ?? 0) * 100))
  const remainingCents =
    typeof entitlements.budgetRemainingCents === 'number'
      ? entitlements.budgetRemainingCents
      : Math.max(0, totalCents - usedCents)

  return { usedCents, totalCents, remainingCents }
}

export function billableBudgetCentsFromProviderUsd(providerCostUsd: number): number {
  return applyMarkupToDollars({ providerCostUsd })
}

export function billableBudgetCentsFromProviderCents(providerCostCents: number): number {
  return applyMarkupToCents({ providerCostCents })
}

export function hasSufficientBudget(entitlements: EntitlementsSnapshot, costCents: number): boolean {
  const { remainingCents } = getBudgetTotals(entitlements)
  return remainingCents >= costCents
}

export function formatBudget(usedCents: number, totalCents: number): string {
  const used = centsToDollarAmount(usedCents).toFixed(2)
  const total = centsToDollarAmount(totalCents).toFixed(2)
  return `$${used} / $${total}`
}
