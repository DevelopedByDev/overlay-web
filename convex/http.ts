import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { registerRoutes } from '@convex-dev/stripe'
import type Stripe from 'stripe'
import {
  extractCustomerInfo,
  getSubscriptionPeriodMs,
  mapPriceToTier,
  mapSubscriptionStatus,
} from './lib/stripeOverlaySubscription'

const http = httpRouter()

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

      const priceId = subscription.items.data[0]?.price?.id
      const tier = mapPriceToTier(priceId)

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
        tier,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart,
        currentPeriodEnd
      })

      console.log(`[Stripe Webhook] Created subscription for user ${userId}: tier=${tier}, priceId=${priceId}, email=${email}`)
    },

    'customer.subscription.updated': async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId

      if (!userId) {
        console.error('[Stripe Webhook] Missing userId in subscription metadata')
        return
      }

      const priceId = subscription.items.data[0]?.price?.id
      const tier = mapPriceToTier(priceId)

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
        tier,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart,
        currentPeriodEnd
      })

      console.log(`[Stripe Webhook] Updated subscription for user ${userId}: tier=${tier}, priceId=${priceId}, email=${email}`)
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

    'checkout.session.completed': async (_ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object
      console.log(`[Stripe Webhook] Checkout completed: ${session.id}, mode: ${session.mode}`)
    }
  },
  onEvent: async (_ctx, event: Stripe.Event) => {
    console.log(`[Stripe Webhook] Received event: ${event.type}`)
  }
})

export default http
