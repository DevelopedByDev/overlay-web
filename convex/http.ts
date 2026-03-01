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

      // Debug: log the entire subscription object structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = subscription as any
      console.log(`[Stripe Webhook] Subscription object keys: ${Object.keys(subAny).join(', ')}`)
      console.log(`[Stripe Webhook] Raw period values: current_period_start=${subAny.current_period_start}, currentPeriodStart=${subAny.currentPeriodStart}`)

      const priceId = subscription.items.data[0]?.price?.id
      const tier = mapPriceToTier(priceId)
      
      // Extract email from metadata (passed during checkout) or from expanded customer
      const customerInfo = extractCustomerInfo(subscription.customer as Stripe.Customer | string)
      const email = subscription.metadata?.email || customerInfo.email
      const name = customerInfo.name

      // Get timestamps - try multiple possible property names
      const periodStart = subAny.current_period_start || subAny.currentPeriodStart || subAny['current_period_start']
      const periodEnd = subAny.current_period_end || subAny.currentPeriodEnd || subAny['current_period_end']
      
      // Calculate with fallbacks - ensure we get valid numbers
      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      const currentPeriodStart = (typeof periodStart === 'number' && periodStart > 0) ? periodStart * 1000 : now
      const currentPeriodEnd = (typeof periodEnd === 'number' && periodEnd > 0) ? periodEnd * 1000 : now + thirtyDays

      console.log(`[Stripe Webhook] Computed periods: start=${currentPeriodStart}, end=${currentPeriodEnd}`)

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

      // Debug: log the entire subscription object structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny = subscription as any
      console.log(`[Stripe Webhook] Updated - Subscription keys: ${Object.keys(subAny).join(', ')}`)

      const priceId = subscription.items.data[0]?.price?.id
      const tier = mapPriceToTier(priceId)
      
      // Extract email from metadata (passed during checkout) or from expanded customer
      const customerInfo = extractCustomerInfo(subscription.customer as Stripe.Customer | string)
      const email = subscription.metadata?.email || customerInfo.email
      const name = customerInfo.name

      // Get timestamps - try multiple possible property names
      const periodStart = subAny.current_period_start || subAny.currentPeriodStart || subAny['current_period_start']
      const periodEnd = subAny.current_period_end || subAny.currentPeriodEnd || subAny['current_period_end']
      
      // Calculate with fallbacks - ensure we get valid numbers
      const now = Date.now()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
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
        await ctx.runMutation(internal.subscriptions.updateStatusInternal, {
          userId,
          status: 'canceled'
        })
        console.log(`[Stripe Webhook] Canceled subscription for user ${userId}`)
      }
    },

    'invoice.paid': async (ctx, event: Stripe.InvoicePaidEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const userId = invoice.subscription_details?.metadata?.userId ?? invoice.metadata?.userId

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
      console.log(`[Stripe Webhook] Checkout completed: ${session.id}, mode: ${session.mode}, type: ${session.metadata?.type}`)
      
      // Handle one-time payments (refill or addon credits)
      if (session.mode === 'payment') {
        const paymentType = session.metadata?.type
        const userId = session.metadata?.userId
        const credits = parseFloat(session.metadata?.credits || '0')

        if (userId && credits > 0 && (paymentType === 'refill' || paymentType === 'addon')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sessionAny = session as any
          const paymentIntentId = typeof sessionAny.payment_intent === 'string'
            ? sessionAny.payment_intent
            : sessionAny.payment_intent?.id

          await ctx.runMutation(internal.subscriptions.addRefillCreditsInternal, {
            userId,
            credits,
            stripePaymentIntentId: paymentIntentId
          })

          // If autoRenew is enabled for addon, update the subscription settings
          if (paymentType === 'addon' && session.metadata?.autoRenew === 'true') {
            await ctx.runMutation(internal.subscriptions.updateAutoRefillInternal, {
              userId,
              autoRefillEnabled: true,
              autoRefillAmount: parseFloat(session.metadata?.amount || '0')
            })
            console.log(`[Stripe Webhook] Enabled auto-refill for user ${userId}`)
          }

          console.log(`[Stripe Webhook] Added ${credits} ${paymentType} credits for user ${userId}`)
        }
      }
    }
  },
  onEvent: async (_ctx, event: Stripe.Event) => {
    console.log(`[Stripe Webhook] Received event: ${event.type}`)
  }
})

export default http
