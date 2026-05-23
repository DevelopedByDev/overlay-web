import { createFreeEntitlements } from '../entitlements'
import type {
  BillingProvider,
  CheckoutArgs,
  CheckoutResult,
  Entitlements,
  PortalResult,
  UsageArgs,
} from '../types'

type MaybeGetter<T> = T | (() => T)

export interface StripeCheckoutSession {
  id: string
  url: string | null
}

export interface StripePortalSession {
  id: string
  url: string
}

export interface StripeCustomer {
  id: string
  deleted?: boolean
}

export interface StripeSubscription {
  id: string
  customer?: string | { id?: string } | null
}

export interface StripeBillingClient {
  checkout: {
    sessions: {
      create(params: Record<string, unknown>): Promise<StripeCheckoutSession>
    }
  }
  billingPortal: {
    sessions: {
      create(params: Record<string, unknown>): Promise<StripePortalSession>
    }
  }
  customers?: {
    retrieve(customerId: string): Promise<string | StripeCustomer>
  }
  subscriptions?: {
    retrieve(subscriptionId: string): Promise<StripeSubscription>
    cancel(subscriptionId: string): Promise<unknown>
  }
}

export interface StripeSubscriptionState {
  email?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

export interface StripeBillingProviderOptions {
  stripe: StripeBillingClient
  baseUrl: MaybeGetter<string>
  paidPlanPriceId?: MaybeGetter<string | null | undefined>
  topUpPriceId?: MaybeGetter<string | null | undefined>
  portalConfigurationId?: MaybeGetter<string | null | undefined>
  getEntitlements?: (userId: string) => Promise<Entitlements | null>
  getSubscriptionState?: (userId: string) => Promise<StripeSubscriptionState | null>
  recordUsage?: (args: UsageArgs) => Promise<void>
  cancelSubscription?: (subscriptionId: string) => Promise<void>
  createFreeEntitlements?: () => Entitlements
  normalizePlanAmountCents?: (amountCents: number) => number
  normalizeTopUpAmountCents?: (amountCents: number) => number
  isRecognizedTopUpAmount?: (amountCents: number) => boolean
  planQuantityForAmountCents?: (amountCents: number) => number
  topUpQuantityForAmountCents?: (amountCents: number) => number
}

function resolve<T>(value: MaybeGetter<T> | undefined): T | undefined {
  return typeof value === 'function' ? (value as () => T)() : value
}

function positiveInteger(value: number): number {
  return Math.max(1, Math.ceil(value))
}

function centsToDollarsQuantity(amountCents: number): number {
  return positiveInteger(amountCents / 100)
}

function toStripeMetadata(metadata: CheckoutArgs['metadata']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value == null) continue
    out[key] = String(value)
  }
  return out
}

export class StripeBillingProvider implements BillingProvider {
  constructor(private readonly options: StripeBillingProviderOptions) {}

  async getEntitlements(userId: string): Promise<Entitlements> {
    return (await this.options.getEntitlements?.(userId)) ?? this.freeEntitlements()
  }

  async createCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    return args.kind === 'budget_topup'
      ? this.createTopUpCheckoutSession(args)
      : this.createPaidPlanCheckoutSession(args)
  }

  async createPortalSession(userId: string): Promise<PortalResult> {
    const subscription = await this.options.getSubscriptionState?.(userId)
    let customerId = await this.resolveExistingCustomerId(subscription?.stripeCustomerId)

    if (!customerId && subscription?.stripeSubscriptionId && this.options.stripe.subscriptions) {
      const stripeSubscription = await this.options.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)
      customerId = await this.resolveExistingCustomerId(
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id,
      )
    }

    if (!customerId) {
      throw new Error('No Stripe customer found for user')
    }

    const portalConfigurationId = resolve(this.options.portalConfigurationId)
    const session = await this.options.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.baseUrl()}/account`,
      ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
    })
    return { url: session.url, providerSessionId: session.id }
  }

  async recordUsage(args: UsageArgs): Promise<void> {
    if (!this.options.recordUsage) {
      throw new Error('StripeBillingProvider.recordUsage requires a recordUsage callback')
    }
    await this.options.recordUsage(args)
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    if (this.options.cancelSubscription) {
      await this.options.cancelSubscription(subscriptionId)
      return
    }
    if (!this.options.stripe.subscriptions) {
      throw new Error('StripeBillingProvider.cancelSubscription requires Stripe subscriptions support')
    }
    await this.options.stripe.subscriptions.cancel(subscriptionId)
  }

  private async createPaidPlanCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    const priceId = resolve(this.options.paidPlanPriceId)
    if (!priceId) {
      throw new Error('Stripe paid plan price ID is not configured')
    }

    const planAmountCents = this.normalizePlanAmount(Number(args.planAmountCents))
    const topUpAmountCents = this.normalizeTopUpAmount(Number(args.topUpAmountCents))
    const quantity = this.options.planQuantityForAmountCents?.(planAmountCents) ?? centsToDollarsQuantity(planAmountCents)
    const autoTopUpEnabled = Boolean(args.autoTopUpEnabled)
    const offSessionConsentAt = autoTopUpEnabled ? Date.now() : undefined
    const metadata = {
      ...toStripeMetadata(args.metadata),
      userId: args.userId,
      kind: 'paid_plan',
      planKind: 'paid',
      planVersion: 'variable_v2',
      planAmountCents: String(planAmountCents),
      stripeQuantity: String(quantity),
      topUpAmountCents: String(topUpAmountCents),
      autoTopUpEnabled: String(autoTopUpEnabled),
      ...(offSessionConsentAt ? { offSessionConsentAt: String(offSessionConsentAt) } : {}),
      ...(args.email ? { email: args.email } : {}),
    }

    const session = await this.options.stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      mode: 'subscription',
      success_url:
        args.successUrl ??
        `${this.baseUrl()}/account?success=true&session_id={CHECKOUT_SESSION_ID}&open_app=true`,
      cancel_url: args.cancelUrl ?? `${this.baseUrl()}/pricing?canceled=true`,
      metadata,
      subscription_data: { metadata },
      ...(args.email ? { customer_email: args.email } : {}),
      allow_promotion_codes: true,
    })

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }
    return { url: session.url, providerSessionId: session.id }
  }

  private async createTopUpCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    const requestedAmountCents = Number(args.topUpAmountCents)
    if (this.options.isRecognizedTopUpAmount && !this.options.isRecognizedTopUpAmount(requestedAmountCents)) {
      throw new Error('Unsupported top-up amount')
    }

    const entitlements = await this.getEntitlements(args.userId)
    if (entitlements.planKind !== 'paid') {
      throw new Error('Top-ups require an active paid plan')
    }

    const priceId = resolve(this.options.topUpPriceId)
    if (!priceId) {
      throw new Error('Stripe top-up price ID is not configured')
    }

    const amountCents = this.normalizeTopUpAmount(requestedAmountCents)
    const quantity = this.options.topUpQuantityForAmountCents?.(amountCents) ?? centsToDollarsQuantity(amountCents)
    const metadata = {
      ...toStripeMetadata(args.metadata),
      kind: 'budget_topup',
      userId: args.userId,
      amountCents: String(amountCents),
      stripeQuantity: String(quantity),
      autoTopUpEnabled: String(Boolean(args.autoTopUpEnabled)),
    }

    const session = await this.options.stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      success_url:
        args.successUrl ??
        `${this.baseUrl()}/account?topup_success=true&topup_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl ?? `${this.baseUrl()}/account?topup_canceled=true`,
      ...(args.email ? { customer_email: args.email } : {}),
      metadata,
      payment_intent_data: { metadata },
      allow_promotion_codes: false,
    })

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }
    return { url: session.url, providerSessionId: session.id }
  }

  private async resolveExistingCustomerId(customerId?: string): Promise<string | undefined> {
    if (!customerId) return undefined
    if (!this.options.stripe.customers) return customerId

    try {
      const customer = await this.options.stripe.customers.retrieve(customerId)
      if (typeof customer === 'string') return customer
      if (customer.deleted) return undefined
      return customer.id
    } catch {
      return undefined
    }
  }

  private baseUrl(): string {
    return resolve(this.options.baseUrl) ?? ''
  }

  private freeEntitlements(): Entitlements {
    return (this.options.createFreeEntitlements ?? createFreeEntitlements)()
  }

  private normalizePlanAmount(amountCents: number): number {
    return this.options.normalizePlanAmountCents?.(amountCents) ?? amountCents
  }

  private normalizeTopUpAmount(amountCents: number): number {
    return this.options.normalizeTopUpAmountCents?.(amountCents) ?? amountCents
  }
}
