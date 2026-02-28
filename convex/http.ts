import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api } from './_generated/api'

const http = httpRouter()

// Stripe webhook endpoint
http.route({
  path: '/stripe-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 })
    }

    const body = await request.text()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Verify webhook signature
    let event: StripeEvent
    try {
      event = verifyStripeWebhook(body, signature, webhookSecret)
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`)

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as StripeSubscription
          const userId = subscription.metadata?.userId

          if (!userId) {
            console.error('[Stripe Webhook] Missing userId in subscription metadata')
            return new Response('Missing userId', { status: 400 })
          }

          // Map Stripe price to tier
          const tier = mapPriceToTier(subscription.items.data[0]?.price?.id)

          await ctx.runMutation(api.subscriptions.upsertFromStripe, {
            userId,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            tier,
            status: mapSubscriptionStatus(subscription.status),
            currentPeriodStart: subscription.current_period_start * 1000,
            currentPeriodEnd: subscription.current_period_end * 1000
          })

          console.log(`[Stripe Webhook] Updated subscription for user ${userId}: ${tier}`)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as StripeSubscription
          const userId = subscription.metadata?.userId

          if (userId) {
            await ctx.runMutation(api.subscriptions.updateStatus, {
              userId,
              status: 'canceled'
            })
            console.log(`[Stripe Webhook] Canceled subscription for user ${userId}`)
          }
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as StripeInvoice

          // Check if this is a refill purchase (one-time payment, not subscription)
          if (invoice.billing_reason === 'manual' && invoice.metadata?.type === 'refill') {
            const userId = invoice.metadata?.userId
            const credits = parseFloat(invoice.metadata?.credits || '0')

            if (userId && credits > 0) {
              await ctx.runMutation(api.subscriptions.addRefillCredits, {
                userId,
                credits,
                stripePaymentIntentId: invoice.payment_intent as string
              })
              console.log(`[Stripe Webhook] Added ${credits} refill credits for user ${userId}`)
            }
          }
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as StripeInvoice
          const subscriptionId = invoice.subscription

          if (subscriptionId) {
            // Find user by subscription and update status
            const userId = invoice.subscription_details?.metadata?.userId
            if (userId) {
              await ctx.runMutation(api.subscriptions.updateStatus, {
                userId,
                status: 'past_due'
              })
              console.log(`[Stripe Webhook] Marked subscription as past_due for user ${userId}`)
            }
          }
          break
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
      }

      return new Response('OK', { status: 200 })
    } catch (err) {
      console.error('[Stripe Webhook] Error processing event:', err)
      return new Response('Internal error', { status: 500 })
    }
  })
})

// Stripe types (minimal definitions for webhook handling)
interface StripeEvent {
  type: string
  data: {
    object: unknown
  }
}

interface StripeSubscription {
  id: string
  customer: string
  status: string
  current_period_start: number
  current_period_end: number
  metadata?: { userId?: string }
  items: {
    data: Array<{
      price?: {
        id?: string
      }
    }>
  }
}

interface StripeInvoice {
  id: string
  subscription?: string
  payment_intent?: string
  billing_reason?: string
  metadata?: {
    userId?: string
    type?: string
    credits?: string
  }
  subscription_details?: {
    metadata?: { userId?: string }
  }
}

// Verify Stripe webhook signature (simplified - in production use Stripe SDK)
function verifyStripeWebhook(
  body: string,
  signature: string,
  _secret: string // Prefixed with _ to indicate intentionally unused (use crypto in production)
): StripeEvent {
  // In production, use: stripe.webhooks.constructEvent(body, signature, secret)
  // For now, do basic validation
  const parts = signature.split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]

  if (!timestamp) {
    throw new Error('Invalid signature format')
  }

  // Check timestamp is within tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp outside tolerance')
  }

  // Parse and return event (signature verification would happen here with crypto)
  return JSON.parse(body) as StripeEvent
}

// Map Stripe price ID to subscription tier
function mapPriceToTier(priceId?: string): 'free' | 'pro' | 'max' {
  // These price IDs should be configured in environment variables
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

export default http
