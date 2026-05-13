// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Billing layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface IBilling {
  readonly providerId?: string
  init?(): Promise<void>
  health?(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>
  shutdown?(): Promise<void>

  getUserEntitlements(userId: string): Promise<UserEntitlements>
  recordUsage(userId: string, metric: UsageMetric, amount: number): Promise<void>
  createSubscription(userId: string, planId: string): Promise<SubscriptionResult>
  cancelSubscription(userId: string): Promise<void>
  getInvoices(userId: string): Promise<Invoice[]>
  createCustomerPortalSession(userId: string): Promise<string>
}

export interface UserEntitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  topUpAmountCents?: number
  resetAt?: string
  billingPeriodEnd?: string
}

export interface UsageMetric {
  type: 'ask' | 'write' | 'agent' | 'image' | 'video' | 'transcription'
  modelId?: string
}

export interface SubscriptionResult {
  success: boolean
  subscriptionId?: string
  error?: string
}

export interface Invoice {
  id: string
  amountCents: number
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  createdAt: number
  pdfUrl?: string
}
