import 'server-only'

import type Stripe from 'stripe'
import { stripe, getBaseUrl } from '@/server/billing/stripe'
import {
  getPlanQuantityForCheckout,
  getTopUpPriceId,
  getTopUpQuantityForCheckout,
  isRecognizedTopUpAmount,
  resolvePaidUnitPriceId,
  resolvePortalConfigurationId,
} from '@/server/billing/stripe-billing'
import {
  clampPaidPlanAmountCents,
  clampTopUpAmountCents,
  formatDollarAmount,
  quantityToPlanAmountCents,
} from '@/shared/billing/billing-pricing'
import { sameOriginPathUrl } from '@/shared/security/safe-url'
import { BillingServiceError } from './BillingCustomerService'
import type { BillingRepository } from './BillingRepository'

type BillingCheckoutServiceDeps = {
  baseUrl?: () => string
  clock?: { now(): number }
  repository: BillingRepository
  stripeClient?: Stripe
}

function serviceError(payload: Record<string, unknown>, statusCode: number): never {
  throw new BillingServiceError(payload, statusCode)
}

function objectBody(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getSubscriptionPeriodMs(subscription: Stripe.Subscription) {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const firstItem = subscription.items.data[0]

  return {
    currentPeriodStart:
      typeof firstItem?.current_period_start === 'number' && firstItem.current_period_start > 0
        ? firstItem.current_period_start * 1000
        : subscription.billing_cycle_anchor * 1000 || now,
    currentPeriodEnd:
      typeof firstItem?.current_period_end === 'number' && firstItem.current_period_end > 0
        ? firstItem.current_period_end * 1000
        : now + thirtyDays,
  }
}

function resolveReturnUrl(baseUrl: string, returnPath: unknown, state: 'success' | 'canceled') {
  const url = new URL(sameOriginPathUrl(baseUrl, returnPath, '/account'))
  if (state === 'success') {
    const checkoutSessionPlaceholder = 'CHECKOUT_SESSION_ID_PLACEHOLDER'
    url.searchParams.set('topup_success', 'true')
    url.searchParams.set('topup_session_id', checkoutSessionPlaceholder)
    return url.toString().replace(checkoutSessionPlaceholder, '{CHECKOUT_SESSION_ID}')
  }
  url.searchParams.set('topup_canceled', 'true')
  return url.toString()
}

export class BillingCheckoutService {
  private readonly baseUrl: () => string
  private readonly clock: { now(): number }
  private readonly stripeClient: Stripe

  constructor(private readonly deps: BillingCheckoutServiceDeps) {
    this.baseUrl = deps.baseUrl ?? getBaseUrl
    this.clock = deps.clock ?? { now: () => Date.now() }
    this.stripeClient = deps.stripeClient ?? stripe
  }

  async createSubscriptionCheckout(args: {
    body: unknown
    user: { id: string; email: string }
  }): Promise<{ url: string | null }> {
    const body = objectBody(args.body)
    const planAmountCents = clampPaidPlanAmountCents(Number(body.planAmountCents))
    const requestedTopUpAmountCents = Number(body.topUpAmountCents)
    const autoTopUpEnabled = Boolean(body.autoTopUpEnabled)
    const quantity = getPlanQuantityForCheckout(planAmountCents)
    const priceId = resolvePaidUnitPriceId()

    if (!isRecognizedTopUpAmount(requestedTopUpAmountCents)) {
      serviceError({ error: 'Unsupported top-up amount.' }, 400)
    }
    const topUpAmountCents = clampTopUpAmountCents(requestedTopUpAmountCents)

    if (!priceId) {
      console.error('Missing paid unit Stripe price ID')
      const hint =
        process.env.VERCEL_ENV === 'production'
          ? 'Set STRIPE_PAID_UNIT_PRICE_ID for Production in Vercel.'
          : 'Set DEV_STRIPE_PAID_UNIT_PRICE_ID and/or STRIPE_PAID_UNIT_PRICE_ID for Preview / local.'
      serviceError({ error: `Price ID not configured for the paid plan. ${hint}` }, 500)
    }

    const baseUrl = this.baseUrl()
    const offSessionConsentAt = autoTopUpEnabled ? this.clock.now() : undefined

    const checkoutSession = await this.stripeClient.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      mode: 'subscription',
      success_url: `${baseUrl}/account?success=true&session_id={CHECKOUT_SESSION_ID}&open_app=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        userId: args.user.id,
        kind: 'paid_plan',
        planKind: 'paid',
        planVersion: 'variable_v2',
        planAmountCents: String(planAmountCents),
        stripeQuantity: String(quantity),
        topUpAmountCents: String(topUpAmountCents),
        autoTopUpEnabled: String(autoTopUpEnabled),
        ...(offSessionConsentAt ? { offSessionConsentAt: String(offSessionConsentAt) } : {}),
        email: args.user.email,
      },
      subscription_data: {
        metadata: {
          userId: args.user.id,
          kind: 'paid_plan',
          planKind: 'paid',
          planVersion: 'variable_v2',
          planAmountCents: String(planAmountCents),
          stripeQuantity: String(quantity),
          topUpAmountCents: String(topUpAmountCents),
          autoTopUpEnabled: String(autoTopUpEnabled),
          ...(offSessionConsentAt ? { offSessionConsentAt: String(offSessionConsentAt) } : {}),
          email: args.user.email,
        },
      },
      customer_email: args.user.email,
      allow_promotion_codes: true,
    })

    console.log(
      `[Checkout] Created paid plan session for user ${args.user.id} (${args.user.email}) — plan=${formatDollarAmount(planAmountCents)} quantity=${quantity} topUp=${formatDollarAmount(topUpAmountCents)} autoTopUp=${autoTopUpEnabled}`,
    )
    return { url: checkoutSession.url }
  }

  async verifySubscriptionCheckout(args: {
    sessionId?: string
    userId: string
  }) {
    if (!args.sessionId) {
      serviceError({ error: 'Session ID required' }, 400)
    }

    const checkoutSession = await this.stripeClient.checkout.sessions.retrieve(args.sessionId, {
      expand: ['subscription'],
    })

    if (checkoutSession.metadata?.userId !== args.userId) {
      serviceError({ error: 'Session mismatch' }, 403)
    }

    if (
      checkoutSession.status !== 'complete' ||
      checkoutSession.mode !== 'subscription' ||
      checkoutSession.metadata?.kind !== 'paid_plan' ||
      checkoutSession.payment_status !== 'paid'
    ) {
      serviceError({ error: 'Payment not completed' }, 400)
    }

    const subscription = checkoutSession.subscription as Stripe.Subscription
    if (!subscription || typeof subscription === 'string') {
      serviceError({ error: 'Subscription not found' }, 400)
    }
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      serviceError({ error: 'Subscription is not active' }, 400)
    }
    const firstItem = subscription.items.data[0]
    const priceId = firstItem?.price?.id
    const expectedPriceId = resolvePaidUnitPriceId()
    if (!priceId || (expectedPriceId && priceId !== expectedPriceId)) {
      serviceError({ error: 'Unexpected subscription price' }, 400)
    }
    const metadataQuantity = Number.parseInt(checkoutSession.metadata?.stripeQuantity ?? '0', 10)
    const quantity = firstItem?.quantity ?? (Number.isFinite(metadataQuantity) && metadataQuantity > 0 ? metadataQuantity : 1)
    const planAmountCents = quantityToPlanAmountCents(quantity)
    const topUpAmountCents = Number.parseInt(checkoutSession.metadata?.topUpAmountCents ?? '0', 10) || undefined
    const autoTopUpEnabled = checkoutSession.metadata?.autoTopUpEnabled === 'true'
    const offSessionConsentAt = Number.parseInt(checkoutSession.metadata?.offSessionConsentAt ?? '0', 10) || undefined
    const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodMs(subscription)

    await this.deps.repository.upsertSubscription({
      userId: args.userId,
      stripeCustomerId: checkoutSession.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeQuantity: quantity,
      tier: 'pro',
      planKind: 'paid',
      planVersion: 'variable_v2',
      planAmountCents,
      autoTopUpEnabled,
      autoTopUpAmountCents: topUpAmountCents,
      offSessionConsentAt,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
    })

    console.log('[Checkout Verify] Subscription verified and updated')

    return {
      success: true,
      planKind: 'paid' as const,
      planAmountCents,
      message: 'Subscription activated successfully',
    }
  }

  async createPortalSession(args: {
    accessToken?: string
    body: unknown
    userEmail?: string
    userId: string
  }): Promise<{ url: string | null }> {
    const body = objectBody(args.body)
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined

    let customerId: string | undefined
    let subscriptionId: string | undefined

    if (sessionId) {
      customerId = await this.resolveVerifiedCustomerIdFromCheckoutSession(sessionId, args.userId)
      if (!customerId) {
        serviceError({ error: 'Checkout session does not belong to the authenticated user.' }, 403)
      }
    }

    if (!customerId) {
      const subscription = await this.deps.repository.getSubscriptionByUserId({
        accessToken: args.accessToken ?? '',
        userId: args.userId,
      })
      customerId = await this.resolveExistingCustomerId(subscription?.stripeCustomerId || undefined)
      subscriptionId = subscription?.stripeSubscriptionId || undefined

      if (!customerId && subscriptionId) {
        const stripeSubscription = await this.stripeClient.subscriptions.retrieve(subscriptionId)
        customerId = await this.resolveExistingCustomerId(
          typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id,
        )
      }

      if (!customerId) {
        customerId = await this.findCustomerIdByEmail(args.userEmail || subscription?.email)
      }

      if (customerId && !subscription?.stripeCustomerId) {
        await this.deps.repository.upsertSubscription({
          userId: args.userId,
          email: args.userEmail || subscription?.email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          tier: subscription?.tier,
          planKind: subscription?.planKind,
          planAmountCents: subscription?.planAmountCents,
          status: subscription?.status,
        })
      }
    }

    if (!customerId) {
      serviceError({ error: 'No customer found. Please subscribe first.' }, 400)
    }

    const portalConfigurationId = resolvePortalConfigurationId()
    const baseUrl = this.baseUrl()

    let portalSession
    try {
      portalSession = await this.stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/account`,
        ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
      })
    } catch (error) {
      const stripeError = error as { code?: string; message?: string; type?: string }
      const invalidConfiguration =
        stripeError?.code === 'resource_missing' ||
        (stripeError?.type === 'StripeInvalidRequestError' &&
          stripeError?.message?.toLowerCase().includes('configuration'))

      if (!portalConfigurationId || !invalidConfiguration) {
        throw error
      }

      console.warn(
        `[portal] Falling back to default portal configuration because ${portalConfigurationId} is invalid.`,
      )
      portalSession = await this.stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/account`,
      })
    }

    return { url: portalSession.url }
  }

  async createTopUpCheckout(args: {
    body: unknown
    userEmail?: string
    userId: string
  }): Promise<{ url: string | null }> {
    const body = objectBody(args.body)
    const entitlements = await this.deps.repository.getEntitlementsByServer({
      userId: args.userId,
    })
    if (entitlements?.planKind !== 'paid') {
      serviceError({ error: 'Top-ups require an active paid plan.' }, 403)
    }

    const requestedAmountCents = Number(body.amountCents)
    const autoTopUpEnabled = Boolean(body.autoTopUpEnabled)
    if (!isRecognizedTopUpAmount(requestedAmountCents)) {
      serviceError({ error: 'Unsupported top-up amount' }, 400)
    }
    const amountCents = clampTopUpAmountCents(requestedAmountCents)

    const priceId = getTopUpPriceId()
    if (!priceId) {
      serviceError({ error: 'Top-up price not configured' }, 500)
    }
    const quantity = getTopUpQuantityForCheckout(amountCents)
    const baseUrl = this.baseUrl()
    const checkoutSession = await this.stripeClient.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      success_url: resolveReturnUrl(baseUrl, body.returnPath, 'success'),
      cancel_url: resolveReturnUrl(baseUrl, body.returnPath, 'canceled'),
      ...(args.userEmail ? { customer_email: args.userEmail } : {}),
      metadata: {
        kind: 'budget_topup',
        userId: args.userId,
        amountCents: String(amountCents),
        stripeQuantity: String(quantity),
        autoTopUpEnabled: String(autoTopUpEnabled),
      },
      payment_intent_data: {
        metadata: {
          kind: 'budget_topup',
          userId: args.userId,
          amountCents: String(amountCents),
          stripeQuantity: String(quantity),
          autoTopUpEnabled: String(autoTopUpEnabled),
        },
      },
      allow_promotion_codes: false,
    })

    console.log(`[TopUp Checkout] Created manual top-up checkout for ${args.userId}: ${formatDollarAmount(amountCents)}`)
    return { url: checkoutSession.url }
  }

  async verifyTopUp(args: {
    body: unknown
    userId: string
  }): Promise<{ success: true; amountCents: number }> {
    const body = objectBody(args.body)
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) {
      serviceError({ error: 'Session ID required' }, 400)
    }
    if (
      sessionId !== '{CHECKOUT_SESSION_ID}' &&
      !sessionId.includes('CHECKOUT_SESSION_ID') &&
      !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)
    ) {
      serviceError({ error: 'Invalid session ID' }, 400)
    }

    const checkoutSession = await this.resolveCheckoutSession(sessionId, args.userId)
    if (checkoutSession.metadata?.userId !== args.userId) {
      serviceError({ error: 'Session mismatch' }, 403)
    }
    if (checkoutSession.metadata?.kind !== 'budget_topup') {
      serviceError({ error: 'Invalid top-up session' }, 400)
    }
    if (checkoutSession.payment_status !== 'paid') {
      serviceError({ error: 'Payment not completed' }, 400)
    }
    if (checkoutSession.status !== 'complete' || checkoutSession.currency !== 'usd' || !checkoutSession.amount_total) {
      serviceError({ error: 'Invalid completed top-up session' }, 400)
    }

    const amountCents = checkoutSession.amount_total
    const autoTopUpEnabled = checkoutSession.metadata?.autoTopUpEnabled === 'true'
    await this.deps.repository.recordBudgetTopUp({
      userId: args.userId,
      amountCents,
      source: 'manual',
      stripeCustomerId: typeof checkoutSession.customer === 'string' ? checkoutSession.customer : undefined,
      stripeCheckoutSessionId: checkoutSession.id,
      stripePaymentIntentId: typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : undefined,
      status: 'succeeded',
    })
    await this.deps.repository.updateBillingPreferences({
      userId: args.userId,
      autoTopUpEnabled,
      topUpAmountCents: amountCents,
      grantOffSessionConsent: autoTopUpEnabled,
    })

    return { success: true, amountCents }
  }

  private async findCustomerIdByEmail(email?: string): Promise<string | undefined> {
    if (!email) return undefined

    const customers = await this.stripeClient.customers.list({
      email,
      limit: 10,
    })

    if (customers.data.length === 0) return undefined

    const customersWithActiveSubscriptions = await Promise.all(
      customers.data.map(async (customer) => {
        const subscriptions = await this.stripeClient.subscriptions.list({
          customer: customer.id,
          status: 'all',
          limit: 10,
        })

        const activeSubscription = subscriptions.data.find((subscription) =>
          ['active', 'trialing', 'past_due'].includes(subscription.status),
        )

        return {
          customerId: customer.id,
          activeSubscription,
          created: customer.created ?? 0,
        }
      }),
    )

    const preferred =
      customersWithActiveSubscriptions.find((candidate) => candidate.activeSubscription)?.customerId ??
      customersWithActiveSubscriptions.sort((a, b) => b.created - a.created)[0]?.customerId

    return preferred
  }

  private async resolveExistingCustomerId(customerId?: string): Promise<string | undefined> {
    if (!customerId) return undefined

    try {
      const customer = await this.stripeClient.customers.retrieve(customerId)
      if (typeof customer === 'string') return customer
      if ('deleted' in customer && customer.deleted) return undefined
      return customer.id
    } catch {
      return undefined
    }
  }

  private async resolveVerifiedCustomerIdFromCheckoutSession(
    sessionId: string,
    userId: string,
  ): Promise<string | undefined> {
    const checkoutSession = await this.stripeClient.checkout.sessions.retrieve(sessionId)
    if (checkoutSession.metadata?.userId !== userId) {
      return undefined
    }
    return await this.resolveExistingCustomerId(checkoutSession.customer as string)
  }

  private async findLatestPaidTopUpSession(userId: string) {
    const page = await this.stripeClient.checkout.sessions.list({ limit: 50 })
    return (
      page.data
        .filter((session) =>
          session.metadata?.kind === 'budget_topup' &&
          session.metadata?.userId === userId &&
          session.payment_status === 'paid' &&
          session.status === 'complete',
        )
        .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null
    )
  }

  private async resolveCheckoutSession(sessionId: string, userId: string) {
    const normalizedSessionId = sessionId.trim()
    const looksLikePlaceholder =
      !normalizedSessionId ||
      normalizedSessionId === '{CHECKOUT_SESSION_ID}' ||
      normalizedSessionId.includes('CHECKOUT_SESSION_ID')

    if (!looksLikePlaceholder) {
      try {
        return await this.stripeClient.checkout.sessions.retrieve(normalizedSessionId)
      } catch (error) {
        const stripeError = error as { code?: string }
        if (stripeError?.code !== 'resource_missing') {
          throw error
        }
      }
    }

    const fallbackSession = await this.findLatestPaidTopUpSession(userId)
    if (!fallbackSession) {
      throw new Error('No completed top-up checkout session found for this user')
    }
    return fallbackSession
  }
}
