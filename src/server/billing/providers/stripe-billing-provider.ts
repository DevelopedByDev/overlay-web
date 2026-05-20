import 'server-only'

import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { stripe, getBaseUrl } from '@/server/billing/stripe'
import {
  getPlanQuantityForCheckout,
  getTopUpPriceId,
  getTopUpQuantityForCheckout,
  isRecognizedTopUpAmount,
  resolvePaidUnitPriceId,
  resolvePortalConfigurationId,
} from '@/server/billing/stripe-billing'
import { refreshEntitlementsForUser } from '@/server/billing/billing-runtime'
import {
  clampPaidPlanAmountCents,
  clampTopUpAmountCents,
} from '@/shared/billing/billing-pricing'
import type {
  BillingProvider,
  CheckoutArgs,
  CheckoutResult,
  Entitlements,
  PortalResult,
  UsageArgs,
} from '@overlay/app-core'
import { createFreeEntitlements } from './provider-entitlements'

type SubscriptionBillingState = {
  email?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

function toStripeMetadata(
  metadata: CheckoutArgs['metadata'],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value == null) continue
    out[key] = String(value)
  }
  return out
}

async function resolveExistingCustomerId(customerId?: string): Promise<string | undefined> {
  if (!customerId) return undefined

  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (typeof customer === 'string') return customer
    if ('deleted' in customer && customer.deleted) return undefined
    return customer.id
  } catch {
    return undefined
  }
}

export class StripeBillingProvider implements BillingProvider {
  async getEntitlements(userId: string): Promise<Entitlements> {
    return (await refreshEntitlementsForUser(userId)) ?? createFreeEntitlements()
  }

  async createCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    return args.kind === 'budget_topup'
      ? this.createTopUpCheckoutSession(args)
      : this.createPaidPlanCheckoutSession(args)
  }

  private async createPaidPlanCheckoutSession(args: CheckoutArgs): Promise<CheckoutResult> {
    const priceId = resolvePaidUnitPriceId()
    if (!priceId) {
      throw new Error('Stripe paid plan price ID is not configured')
    }

    const baseUrl = getBaseUrl()
    const planAmountCents = clampPaidPlanAmountCents(Number(args.planAmountCents))
    const topUpAmountCents = clampTopUpAmountCents(Number(args.topUpAmountCents))
    const quantity = getPlanQuantityForCheckout(planAmountCents)
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

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      mode: 'subscription',
      success_url:
        args.successUrl ??
        `${baseUrl}/account?success=true&session_id={CHECKOUT_SESSION_ID}&open_app=true`,
      cancel_url: args.cancelUrl ?? `${baseUrl}/pricing?canceled=true`,
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
    if (!isRecognizedTopUpAmount(requestedAmountCents)) {
      throw new Error('Unsupported top-up amount')
    }

    const entitlements = await this.getEntitlements(args.userId)
    if (entitlements.planKind !== 'paid') {
      throw new Error('Top-ups require an active paid plan')
    }

    const priceId = getTopUpPriceId()
    if (!priceId) {
      throw new Error('Stripe top-up price ID is not configured')
    }

    const baseUrl = getBaseUrl()
    const amountCents = clampTopUpAmountCents(requestedAmountCents)
    const quantity = getTopUpQuantityForCheckout(amountCents)
    const metadata = {
      ...toStripeMetadata(args.metadata),
      kind: 'budget_topup',
      userId: args.userId,
      amountCents: String(amountCents),
      stripeQuantity: String(quantity),
      autoTopUpEnabled: String(Boolean(args.autoTopUpEnabled)),
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      success_url:
        args.successUrl ??
        `${baseUrl}/account?topup_success=true&topup_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: args.cancelUrl ?? `${baseUrl}/account?topup_canceled=true`,
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

  async createPortalSession(userId: string): Promise<PortalResult> {
    const subscription = await convex.query<SubscriptionBillingState | null>(
      'billing/subscriptions:getByUserIdByServer',
      {
        serverSecret: getInternalApiSecret(),
        userId,
      },
      { throwOnError: true },
    )
    let customerId = await resolveExistingCustomerId(subscription?.stripeCustomerId)

    if (!customerId && subscription?.stripeSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)
      customerId = await resolveExistingCustomerId(
        typeof stripeSubscription.customer === 'string'
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id,
      )
    }

    if (!customerId) {
      throw new Error('No Stripe customer found for user')
    }

    const portalConfigurationId = resolvePortalConfigurationId()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getBaseUrl()}/account`,
      ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
    })
    return { url: session.url, providerSessionId: session.id }
  }

  async recordUsage(args: UsageArgs): Promise<void> {
    if (!args.accessToken) {
      throw new Error('StripeBillingProvider.recordUsage requires an access token')
    }

    await convex.mutation(
      'platform/usage:recordUsage',
      {
        accessToken: args.accessToken,
        userId: args.userId,
        type: args.type,
        modelId: args.modelId,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        cachedTokens: args.cachedTokens,
        cost: args.cost,
      },
      { throwOnError: true },
    )
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await stripe.subscriptions.cancel(subscriptionId)
  }
}
