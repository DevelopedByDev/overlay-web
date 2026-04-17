import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { registerRoutes } from '@convex-dev/stripe'
import type Stripe from 'stripe'
import {
  extractPlanFromSubscription,
  extractCustomerInfo,
  getSubscriptionPeriodMs,
  mapSubscriptionStatus,
} from './lib/stripeOverlaySubscription'

const http = httpRouter()

function readBooleanMetadata(value: string | undefined): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function readNumberMetadata(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

// Register Stripe webhook handler using @convex-dev/stripe component
registerRoutes(http, components.stripe, {
  webhookPath: '/stripe/webhook',
  events: {
    // Sync subscription changes to our custom subscriptions table
    'customer.subscription.created': async (ctx, event: Stripe.CustomerSubscriptionCreatedEvent) => {
      const subscription = event.data.object

      const userId = subscription.metadata?.userId

      if (!userId) {
        console.error('[Stripe Webhook] Missing userId in subscription metadata')
        return
      }

      const plan = extractPlanFromSubscription(subscription)

      const customerInfo = extractCustomerInfo(subscription.customer as Stripe.Customer | string)
      const email = subscription.metadata?.email || customerInfo.email
      const name = customerInfo.name

      const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodMs(subscription)

      await ctx.runMutation(internal.subscriptions.upsertFromStripeInternal, {
        userId,
        email,
        name,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: plan.stripePriceId,
        stripeQuantity: plan.stripeQuantity,
        tier: plan.tier,
        planKind: plan.planKind,
        planVersion: plan.planVersion,
        planAmountCents: plan.planAmountCents,
        autoTopUpEnabled: readBooleanMetadata(subscription.metadata?.autoTopUpEnabled),
        autoTopUpAmountCents: readNumberMetadata(subscription.metadata?.topUpAmountCents),
        offSessionConsentAt: readNumberMetadata(subscription.metadata?.offSessionConsentAt),
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart,
        currentPeriodEnd
      })

      console.log(`[Stripe Webhook] Created subscription for user ${userId}: tier=${plan.tier}, planKind=${plan.planKind}, planAmountCents=${plan.planAmountCents}, priceId=${plan.stripePriceId}, email=${email}`)
    },

    'customer.subscription.updated': async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId

      if (!userId) {
        console.error('[Stripe Webhook] Missing userId in subscription metadata')
        return
      }

      const plan = extractPlanFromSubscription(subscription)

      const customerInfo = extractCustomerInfo(subscription.customer as Stripe.Customer | string)
      const email = subscription.metadata?.email || customerInfo.email
      const name = customerInfo.name

      const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodMs(subscription)

      await ctx.runMutation(internal.subscriptions.upsertFromStripeInternal, {
        userId,
        email,
        name,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: plan.stripePriceId,
        stripeQuantity: plan.stripeQuantity,
        tier: plan.tier,
        planKind: plan.planKind,
        planVersion: plan.planVersion,
        planAmountCents: plan.planAmountCents,
        autoTopUpEnabled: readBooleanMetadata(subscription.metadata?.autoTopUpEnabled),
        autoTopUpAmountCents: readNumberMetadata(subscription.metadata?.topUpAmountCents),
        offSessionConsentAt: readNumberMetadata(subscription.metadata?.offSessionConsentAt),
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart,
        currentPeriodEnd
      })

      console.log(`[Stripe Webhook] Updated subscription for user ${userId}: tier=${plan.tier}, planKind=${plan.planKind}, planAmountCents=${plan.planAmountCents}, priceId=${plan.stripePriceId}, email=${email}`)
    },

    'customer.subscription.deleted': async (ctx, event: Stripe.CustomerSubscriptionDeletedEvent) => {
      const subscription = event.data.object

      const userId = subscription.metadata?.userId

      if (userId) {
        await ctx.runMutation(internal.subscriptions.updateStatus, {
          userId,
          status: 'canceled'
        })
        console.log(`[Stripe Webhook] Canceled subscription for user ${userId}`)
      }
    },

    'invoice.payment_failed': async (ctx, event: Stripe.InvoicePaymentFailedEvent) => {
      const invoice = event.data.object

      console.log(`[HTTP] invoice.payment_failed: invoiceId=${invoice.id}`)

      const userId =
        invoice.parent?.subscription_details?.metadata?.userId ??
        invoice.metadata?.userId

      if (userId) {
        await ctx.runMutation(internal.subscriptions.updateStatus, {
          userId,
          status: 'past_due'
        })
        console.log(`[Stripe Webhook] Marked subscription as past_due for user ${userId}`)
      }
    },

    'checkout.session.completed': async (ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object
      console.log(`[Stripe Webhook] Checkout completed: ${session.id}, mode: ${session.mode}`)
      if (session.metadata?.kind === 'budget_topup' && session.payment_status === 'paid' && session.metadata.userId) {
        await ctx.runMutation(internal.subscriptions.recordBudgetTopUpInternal, {
          userId: session.metadata.userId,
          amountCents: Number.parseInt(session.metadata.amountCents ?? '0', 10) || 0,
          source: 'manual',
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          status: 'succeeded',
        })
        await ctx.runMutation(internal.subscriptions.updateBillingPreferencesInternal, {
          userId: session.metadata.userId,
          autoTopUpEnabled: session.metadata.autoTopUpEnabled === 'true',
          topUpAmountCents: Number.parseInt(session.metadata.amountCents ?? '0', 10) || undefined,
          grantOffSessionConsent: session.metadata.autoTopUpEnabled === 'true',
        })
      }
    }
  },
  onEvent: async (_ctx, event: Stripe.Event) => {
    console.log(`[Stripe Webhook] Received event: ${event.type}`)
  }
})

export default http
