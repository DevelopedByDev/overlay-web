import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Entitlements } from '@/lib/app-contracts'
import {
  applyMarkupToCents,
  applyMarkupToDollars,
  centsToDollarAmount,
  clampTopUpAmountCents,
  TOP_UP_MAX_AMOUNT_CENTS,
  TOP_UP_MIN_AMOUNT_CENTS,
  TOP_UP_STEP_AMOUNT_CENTS,
} from '@/lib/billing-pricing'
import { maybeAutoTopUpBudget } from '@/lib/stripe-billing'
import { getConfig } from '@/lib/config/singleton'

export function isPaidPlan(entitlements: Pick<Entitlements, 'tier' | 'planKind'>): boolean {
  if (entitlements.planKind) return entitlements.planKind === 'paid'
  return entitlements.tier !== 'free'
}

export function getBillingMode(): 'stripe' | 'disabled' | 'manual' {
  const config = getConfig()
  if (config.providers.billing === 'disabled' || config.billing.provider === 'none') return 'disabled'
  if (config.providers.billing === 'manual') return 'manual'
  return 'stripe'
}

export function isBillingDisabled(): boolean {
  const mode = getBillingMode()
  return mode === 'disabled' || mode === 'manual'
}

export function getSelfHostedEntitlements(): Entitlements {
  const budgetTotalCents = 1_000_000_000
  return {
    tier: 'max',
    planKind: 'free',
    planAmountCents: 0,
    creditsUsed: 0,
    creditsTotal: budgetTotalCents / 100,
    budgetUsedCents: 0,
    budgetTotalCents,
    budgetRemainingCents: budgetTotalCents,
    autoTopUpEnabled: false,
    autoTopUpAmountCents: 0,
    autoTopUpConsentGranted: false,
    topUpAmountCents: 0,
    topUpMinAmountCents: TOP_UP_MIN_AMOUNT_CENTS,
    topUpMaxAmountCents: TOP_UP_MAX_AMOUNT_CENTS,
    topUpStepAmountCents: TOP_UP_STEP_AMOUNT_CENTS,
    dailyUsage: { ask: 0, write: 0, agent: 0 },
    dailyLimits: { ask: 999999, write: 999999, agent: 999999 },
    overlayStorageBytesUsed: 0,
    overlayStorageBytesLimit: 10 * 1024 * 1024 * 1024 * 1024,
    transcriptionSecondsUsed: 0,
    transcriptionSecondsLimit: 999999,
    localTranscriptionEnabled: true,
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    billingPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    lastSyncedAt: Date.now(),
  }
}

export function getBudgetTotals(entitlements: Pick<
  Entitlements,
  'creditsUsed' | 'creditsTotal' | 'budgetUsedCents' | 'budgetTotalCents' | 'budgetRemainingCents'
>) {
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

export async function refreshEntitlementsForUser(userId: string): Promise<Entitlements | null> {
  if (isBillingDisabled()) return getSelfHostedEntitlements()
  return await convex.query<Entitlements | null>(
    'usage:getEntitlementsByServer',
    {
      serverSecret: getInternalApiSecret(),
      userId,
    },
    { throwOnError: true },
  )
}

export async function ensureBudgetAvailable(params: {
  userId: string
  entitlements: Entitlements
  minimumRequiredCents?: number
}) {
  if (isBillingDisabled()) {
    const entitlements = getSelfHostedEntitlements()
    return {
      entitlements,
      remainingCents: entitlements.budgetRemainingCents ?? 0,
      autoTopUpApplied: false,
      autoTopUpReason: 'billing_disabled',
    } as const
  }

  const minimumRequiredCents = Math.max(1, Math.round(params.minimumRequiredCents ?? 1))
  const current = getBudgetTotals(params.entitlements)

  if (!isPaidPlan(params.entitlements) || current.remainingCents >= minimumRequiredCents) {
    return {
      entitlements: params.entitlements,
      remainingCents: current.remainingCents,
      autoTopUpApplied: false,
      autoTopUpReason: 'not_needed',
    } as const
  }

  const autoTopUp = await maybeAutoTopUpBudget({
    userId: params.userId,
    minimumRequiredCents,
  })

  if (!autoTopUp.applied) {
    return {
      entitlements: params.entitlements,
      remainingCents: current.remainingCents,
      autoTopUpApplied: false,
      autoTopUpReason: autoTopUp.reason,
    } as const
  }

  const refreshed = await refreshEntitlementsForUser(params.userId)
  const nextEntitlements = refreshed ?? params.entitlements
  const nextBudget = getBudgetTotals(nextEntitlements)

  return {
    entitlements: nextEntitlements,
    remainingCents: nextBudget.remainingCents,
    autoTopUpApplied: true,
    autoTopUpAmountCents: autoTopUp.amountCents,
    autoTopUpReason: autoTopUp.reason,
  } as const
}

export function formatBudgetUsage(entitlements: Pick<
  Entitlements,
  'creditsUsed' | 'creditsTotal' | 'budgetUsedCents' | 'budgetTotalCents' | 'budgetRemainingCents'
>) {
  const { usedCents, totalCents, remainingCents } = getBudgetTotals(entitlements)
  const usedPct = totalCents > 0 ? Math.min(100, (usedCents / totalCents) * 100) : 0
  const remainingPct = totalCents > 0 ? Math.max(0, 100 - usedPct) : 0

  return {
    usedCents,
    totalCents,
    remainingCents,
    usedDollars: centsToDollarAmount(usedCents),
    totalDollars: centsToDollarAmount(totalCents),
    remainingDollars: centsToDollarAmount(remainingCents),
    usedPct,
    remainingPct,
  }
}

export function getTopUpPreferenceSnapshot(entitlements: Pick<
  Entitlements,
  'autoTopUpEnabled' | 'autoTopUpAmountCents'
>) {
  const topUpAmountCents = clampTopUpAmountCents(
    typeof entitlements.autoTopUpAmountCents === 'number' && entitlements.autoTopUpAmountCents > 0
      ? entitlements.autoTopUpAmountCents
      : TOP_UP_MIN_AMOUNT_CENTS,
  )

  return {
    topUpAmountCents,
    autoTopUpEnabled: Boolean(entitlements.autoTopUpEnabled),
    topUpMinAmountCents: TOP_UP_MIN_AMOUNT_CENTS,
    topUpMaxAmountCents: TOP_UP_MAX_AMOUNT_CENTS,
    topUpStepAmountCents: TOP_UP_STEP_AMOUNT_CENTS,
    autoTopUpAmountCents: topUpAmountCents,
  }
}

export function buildInsufficientCreditsPayload(
  entitlements: Pick<Entitlements, 'autoTopUpEnabled' | 'autoTopUpAmountCents'>,
  message: string,
) {
  return {
    error: 'insufficient_credits',
    message,
    billingAction: {
      type: 'top_up',
      ...getTopUpPreferenceSnapshot(entitlements),
    },
  } as const
}
