import { httpRouter } from 'convex/server'
import { components } from './_generated/api'
import { registerRoutes } from '@convex-dev/stripe'
import type Stripe from 'stripe'
import { internal } from './_generated/api'

const http = httpRouter()

// Map Stripe price ID to subscription tier
function mapPriceToTier(priceId?: string): 'free' | 'pro' | 'max' {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID
  const maxPriceId = process.env.STRIPE_MAX_PRICE_ID

  if (priceId === proPriceId) return 'pro'
  if (priceId === maxPriceId) return 'max'
  return 'free'
}

// Map Stripe subscription status to our status
function mapSubscriptionStatus(
  status: string
): 'active' | 'canceled' | 'past_due' | 'trialing' {
  switch (status) {
    case 'active':
      return 'active'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'past_due':
      return 'past_due'
    case 'trialing':
      return 'trialing'
    default:
      return 'active'
  }
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

      const tier = mapPriceToTier(subscription.items.data[0]?.price?.id)

      await ctx.runMutation(internal.subscriptions.upsertFromStripeInternal, {
        userId,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        tier,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000
      })

      console.log(`[Stripe Webhook] Created subscription for user ${userId}: ${tier}`)
    },

    'customer.subscription.updated': async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId

      if (!userId) {
        console.error('[Stripe Webhook] Missing userId in subscription metadata')
        return
      }

      const tier = mapPriceToTier(subscription.items.data[0]?.price?.id)

      await ctx.runMutation(internal.subscriptions.upsertFromStripeInternal, {
        userId,
        stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        tier,
        status: mapSubscriptionStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000
      })

      console.log(`[Stripe Webhook] Updated subscription for user ${userId}: ${tier}`)
    },

    'customer.subscription.deleted': async (ctx, event: Stripe.CustomerSubscriptionDeletedEvent) => {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId

      if (userId) {
        await ctx.runMutation(internal.subscriptions.updateStatusInternal, {
          userId,
          status: 'canceled'
        })
        console.log(`[Stripe Webhook] Canceled subscription for user ${userId}`)
      }
    },

    'invoice.paid': async (ctx, event: Stripe.InvoicePaidEvent) => {
      const invoice = event.data.object

      // Check if this is a refill purchase
      if (invoice.metadata?.type === 'refill') {
        const userId = invoice.metadata?.userId
        const credits = parseFloat(invoice.metadata?.credits || '0')

        if (userId && credits > 0) {
          await ctx.runMutation(internal.subscriptions.addRefillCreditsInternal, {
            userId,
            credits,
            stripePaymentIntentId: typeof invoice.payment_intent === 'string' 
              ? invoice.payment_intent 
              : invoice.payment_intent?.id
          })
          console.log(`[Stripe Webhook] Added ${credits} refill credits for user ${userId}`)
        }
      }
    },

    'invoice.payment_failed': async (ctx, event: Stripe.InvoicePaymentFailedEvent) => {
      const invoice = event.data.object
      const userId = invoice.subscription_details?.metadata?.userId

      if (userId) {
        await ctx.runMutation(internal.subscriptions.updateStatusInternal, {
          userId,
          status: 'past_due'
        })
        console.log(`[Stripe Webhook] Marked subscription as past_due for user ${userId}`)
      }
    },

    'checkout.session.completed': async (ctx, event: Stripe.CheckoutSessionCompletedEvent) => {
      const session = event.data.object
      console.log(`[Stripe Webhook] Checkout completed: ${session.id}, mode: ${session.mode}`)
      
      // For refill payments, handle the credits
      if (session.mode === 'payment' && session.metadata?.type === 'refill') {
        const userId = session.metadata?.userId
        const credits = parseFloat(session.metadata?.credits || '0')

        if (userId && credits > 0) {
          await ctx.runMutation(internal.subscriptions.addRefillCreditsInternal, {
            userId,
            credits,
            stripePaymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id
          })
          console.log(`[Stripe Webhook] Added ${credits} refill credits for user ${userId}`)
        }
      }
    }
  },
  onEvent: async (_ctx, event: Stripe.Event) => {
    console.log(`[Stripe Webhook] Received event: ${event.type}`)
  }
})

export default http
