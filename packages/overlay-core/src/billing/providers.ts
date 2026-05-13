import type {
  IBilling,
  Invoice,
  SubscriptionResult,
  UsageMetric,
  UserEntitlements,
} from './interface'

export interface DisabledBillingOptions {
  tier?: UserEntitlements['tier']
  creditsTotal?: number
  budgetTotalCents?: number
}

export class DisabledBillingProvider implements IBilling {
  readonly providerId: string = 'disabled'

  constructor(private readonly options: DisabledBillingOptions = {}) {}

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 }
  }

  async getUserEntitlements(_userId: string): Promise<UserEntitlements> {
    const budgetTotalCents = this.options.budgetTotalCents ?? 1_000_000_000
    return {
      tier: this.options.tier ?? 'max',
      planKind: 'free',
      creditsUsed: 0,
      creditsTotal: this.options.creditsTotal ?? budgetTotalCents / 100,
      budgetUsedCents: 0,
      budgetTotalCents,
      budgetRemainingCents: budgetTotalCents,
      autoTopUpEnabled: false,
      topUpAmountCents: 0,
    }
  }

  async recordUsage(_userId: string, _metric: UsageMetric, _amount: number): Promise<void> {}

  async createSubscription(): Promise<SubscriptionResult> {
    return { success: false, error: 'Billing is disabled for this deployment.' }
  }

  async cancelSubscription(): Promise<void> {}

  async getInvoices(): Promise<Invoice[]> {
    return []
  }

  async createCustomerPortalSession(): Promise<string> {
    throw new Error('Billing portal is unavailable because billing is disabled.')
  }
}

export class ManualBillingProvider extends DisabledBillingProvider {
  readonly providerId: string = 'manual'
}

export class StripeBillingProvider implements IBilling {
  readonly providerId = 'stripe'

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    return { ok: Boolean(process.env.STRIPE_SECRET_KEY || process.env.DEV_STRIPE_SECRET_KEY), message: 'Stripe configured via existing app facade.' }
  }

  async getUserEntitlements(_userId: string): Promise<UserEntitlements> {
    throw new Error('Stripe entitlements are served by the existing billing facade until database billing migration completes.')
  }

  async recordUsage(_userId: string, _metric: UsageMetric, _amount: number): Promise<void> {}

  async createSubscription(): Promise<SubscriptionResult> {
    throw new Error('Stripe checkout is served by the existing billing facade.')
  }

  async cancelSubscription(): Promise<void> {
    throw new Error('Stripe cancellation is served by the existing billing facade.')
  }

  async getInvoices(): Promise<Invoice[]> {
    return []
  }

  async createCustomerPortalSession(): Promise<string> {
    throw new Error('Stripe portal is served by the existing billing facade.')
  }
}
