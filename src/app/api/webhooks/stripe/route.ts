import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { convex } from '@/lib/convex'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Handle subscription checkout
        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const userId = session.metadata?.userId
          const tier = session.metadata?.tier as 'pro' | 'max'

          if (userId) {
            await convex.mutation('subscriptions:upsertSubscription', {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              tier: tier || 'pro',
              status: 'active',
              currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start,
              currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end,
              autoRefillEnabled: false
            })

            console.log(`[Webhook] Subscription created for user ${userId}: ${tier}`)
          }
        }

        // Handle refill purchase
        if (session.mode === 'payment' && session.metadata?.type === 'refill') {
          const userId = session.metadata.userId
          const creditAmount = parseFloat(session.metadata.creditAmount || '0')

          if (userId && creditAmount > 0) {
            await convex.mutation('usage:addRefillCredits', {
              userId,
              amount: creditAmount
            })

            console.log(`[Webhook] Refill credits added for user ${userId}: $${creditAmount}`)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Look up user by Stripe customer ID
        interface SubscriptionRecord {
          userId: string
          stripeCustomerId?: string
          tier: 'free' | 'pro' | 'max'
        }

        const existingSubscription = await convex.query<SubscriptionRecord>(
          'subscriptions:getByStripeCustomerId',
          { stripeCustomerId: customerId }
        )

        if (existingSubscription) {
          // Determine tier from price
          const priceId = subscription.items.data[0]?.price.id
          let tier: 'free' | 'pro' | 'max' = existingSubscription.tier

          // Check price lookup key to determine tier
          const price = await stripe.prices.retrieve(priceId)
          if (price.lookup_key === 'pro_monthly') tier = 'pro'
          else if (price.lookup_key === 'max_monthly') tier = 'max'

          // Map Stripe status to our status
          let status: 'active' | 'canceled' | 'past_due' | 'trialing' = 'active'
          if (subscription.status === 'canceled') status = 'canceled'
          else if (subscription.status === 'past_due') status = 'past_due'
          else if (subscription.status === 'trialing') status = 'trialing'

          await convex.mutation('subscriptions:upsertSubscription', {
            userId: existingSubscription.userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            tier,
            status,
            currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start,
            currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end
          })

          console.log(`[Webhook] Subscription updated for user ${existingSubscription.userId}: ${tier} (${status})`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        interface SubscriptionRecord {
          userId: string
        }

        const existingSubscription = await convex.query<SubscriptionRecord>(
          'subscriptions:getByStripeCustomerId',
          { stripeCustomerId: customerId }
        )

        if (existingSubscription) {
          await convex.mutation('subscriptions:downgradeToFree', {
            userId: existingSubscription.userId
          })

          console.log(`[Webhook] Subscription canceled, downgraded to free: ${existingSubscription.userId}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        // Handle subscription renewal - reset token usage
        if (invoice.billing_reason === 'subscription_cycle') {
          const customerId = invoice.customer as string

          interface SubscriptionRecord {
            userId: string
          }

          const subscription = await convex.query<SubscriptionRecord>(
            'subscriptions:getByStripeCustomerId',
            { stripeCustomerId: customerId }
          )

          if (subscription) {
            const periodStart = new Date().toISOString().split('T')[0]
            await convex.mutation('usage:resetTokenUsage', {
              userId: subscription.userId,
              newPeriodStart: periodStart
            })

            console.log(`[Webhook] Token usage reset for user ${subscription.userId}`)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        interface SubscriptionRecord {
          userId: string
        }

        const subscription = await convex.query<SubscriptionRecord>(
          'subscriptions:getByStripeCustomerId',
          { stripeCustomerId: customerId }
        )

        if (subscription) {
          await convex.mutation('subscriptions:upsertSubscription', {
            userId: subscription.userId,
            stripeCustomerId: customerId,
            tier: 'pro', // Keep current tier but mark as past_due
            status: 'past_due'
          })

          console.log(`[Webhook] Payment failed for user ${subscription.userId}`)
        }
        break
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
