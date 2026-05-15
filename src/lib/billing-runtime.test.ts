import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canUsePaidBudgetFeatures,
  usesFreeTierPrivileges,
} from './billing-runtime'

test('free plans use free-tier privileges', () => {
  const entitlements = {
    tier: 'free' as const,
    planKind: 'free' as const,
    creditsUsed: 0,
    creditsTotal: 0,
    budgetUsedCents: 0,
    budgetTotalCents: 0,
    budgetRemainingCents: 0,
  }

  assert.equal(canUsePaidBudgetFeatures(entitlements), false)
  assert.equal(usesFreeTierPrivileges(entitlements), true)
})

test('paid plans with budget can use paid-budget features', () => {
  const entitlements = {
    tier: 'pro' as const,
    planKind: 'paid' as const,
    creditsUsed: 500,
    creditsTotal: 800,
    budgetUsedCents: 500,
    budgetTotalCents: 800,
    budgetRemainingCents: 300,
  }

  assert.equal(canUsePaidBudgetFeatures(entitlements), true)
  assert.equal(usesFreeTierPrivileges(entitlements), false)
})

test('paid plans with exhausted budget fall back to free-tier privileges', () => {
  const entitlements = {
    tier: 'pro' as const,
    planKind: 'paid' as const,
    creditsUsed: 800,
    creditsTotal: 800,
    budgetUsedCents: 800,
    budgetTotalCents: 800,
    budgetRemainingCents: 0,
    overlayStorageBytesLimit: 10_000_000_000,
  }

  assert.equal(canUsePaidBudgetFeatures(entitlements), false)
  assert.equal(usesFreeTierPrivileges(entitlements), true)
  assert.equal(entitlements.overlayStorageBytesLimit, 10_000_000_000)
})
