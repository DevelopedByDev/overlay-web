import assert from 'node:assert/strict'
import test from 'node:test'
import { BillingCheckoutService } from './BillingCheckoutService'
import { BillingServiceError } from './BillingCustomerService'
import type { BillingRepository } from './BillingRepository'

function createRepository(overrides: Partial<BillingRepository> = {}): BillingRepository {
  return {
    async getEntitlementsByServer() {
      return {
        tier: 'pro',
        planKind: 'paid',
        planAmountCents: 2000,
        budgetUsedCents: 0,
        budgetTotalCents: 2000,
        budgetRemainingCents: 2000,
        autoTopUpEnabled: false,
        autoTopUpAmountCents: 1000,
        autoTopUpConsentGranted: false,
        creditsUsed: 0,
        creditsTotal: 20,
      }
    },
    async getSubscriptionByUserIdByServer() {
      return null
    },
    async getSubscriptionByUserId() {
      return null
    },
    async updateBillingPreferences() {
      return { success: true }
    },
    async upsertSubscription() {
      return null
    },
    async listBudgetTopUpsByServer() {
      return []
    },
    async recordBudgetTopUp() {
      return null
    },
    ...overrides,
  }
}

function createService(repository = createRepository()) {
  return new BillingCheckoutService({
    repository,
    baseUrl: () => 'https://overlay.test',
    stripeClient: {} as never,
  })
}

test('BillingCheckoutService.createSubscriptionCheckout preserves unsupported top-up error shape', async () => {
  const service = createService()

  await assert.rejects(
    () => service.createSubscriptionCheckout({
      user: { id: 'user_1', email: 'user@example.com' },
      body: { topUpAmountCents: 123 },
    }),
    (error) =>
      error instanceof BillingServiceError &&
      error.statusCode === 400 &&
      error.payload.error === 'Unsupported top-up amount.',
  )
})

test('BillingCheckoutService.createTopUpCheckout requires paid plan', async () => {
  const service = createService(createRepository({
    async getEntitlementsByServer() {
      return {
        tier: 'free',
        planKind: 'free',
        planAmountCents: 0,
        budgetUsedCents: 0,
        budgetTotalCents: 0,
        budgetRemainingCents: 0,
        autoTopUpEnabled: false,
        autoTopUpAmountCents: 1000,
        autoTopUpConsentGranted: false,
        creditsUsed: 0,
        creditsTotal: 0,
      }
    },
  }))

  await assert.rejects(
    () => service.createTopUpCheckout({
      userId: 'user_1',
      body: { amountCents: 1000 },
    }),
    (error) =>
      error instanceof BillingServiceError &&
      error.statusCode === 403 &&
      error.payload.error === 'Top-ups require an active paid plan.',
  )
})

test('BillingCheckoutService.verifyTopUp preserves session validation errors', async () => {
  const service = createService()

  await assert.rejects(
    () => service.verifyTopUp({
      userId: 'user_1',
      body: {},
    }),
    (error) =>
      error instanceof BillingServiceError &&
      error.statusCode === 400 &&
      error.payload.error === 'Session ID required',
  )

  await assert.rejects(
    () => service.verifyTopUp({
      userId: 'user_1',
      body: { sessionId: 'bad_session' },
    }),
    (error) =>
      error instanceof BillingServiceError &&
      error.statusCode === 400 &&
      error.payload.error === 'Invalid session ID',
  )
})
