import { httpRouter } from 'convex/server'
import { components } from './_generated/api'
import { registerRoutes } from '@convex-dev/stripe'
import type Stripe from 'stripe'
import { internal } from './_generated/api'

const http = httpRouter()

// Map Stripe price ID to subscription tier
function mapPriceToTier(priceId?: string): 'free' | 'pro' | 'max' {
  // Check both DEV_ prefixed (for dev environment) and non-prefixed (for production) env vars
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID || process.env.DEV_STRIPE_PRO_PRICE_ID
  const maxPriceId = process.env.STRIPE_MAX_PRICE_ID || process.env.DEV_STRIPE_MAX_PRICE_ID

  console.log(`[Stripe Webhook] mapPriceToTier: priceId=${priceId}, proPriceId=${proPriceId}, maxPriceId=${maxPriceId}`)

  if (priceId === proPriceId) return 'pro'
  if (priceId === maxPriceId) return 'max'
  
  console.warn(`[Stripe Webhook] Unknown price ID: ${priceId}, defaulting to free`)
  return 'free'
}

// Extract customer email and name from Stripe customer object
function extractCustomerInfo(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): { email?: string; name?: string } {
  if (!customer || typeof customer === 'string') {
    return {}
  }
  
  if ('deleted' in customer && customer.deleted) {
    return {}
  }
  
  return {
    email: customer.email || undefined,
    name: customer.name || undefined
  }
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

      const priceId = subscription.items.data[0]?.price?.id
      const tier = mapPriceToTier(priceId)

      const customerInfo = extractCustomerInfo(subscription.customer as Stripe.Customer | string)
      const email = subscription.metadata?.email || customerInfo.email
      const name = customerInfo.name

      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const periodStart = subscription.current_period_start
      const periodEnd = subscription.current_period_end
      const currentPeriodStart = (typeof periodStart === 'number' && periodStart > 0) ? periodStart * 1000 : now
      const currentPeriodEnd = (typeof periodEnd === 'number' && periodEnd > 0) ? periodEnd * 1000 : now + thirtyDays

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

      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const periodStart = subscription.current_period_start
      const periodEnd = subscription.current_period_end
      const currentPeriodStart = (typeof periodStart === 'number' && periodStart > 0) ? periodStart * 1000 : now
      const currentPeriodEnd = (typeof periodEnd === 'number' && periodEnd > 0) ? periodEnd * 1000 : now + thirtyDays

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
      const userId = invoice.subscription_details?.metadata?.userId ?? invoice.metadata?.userId

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
