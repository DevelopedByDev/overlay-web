import { httpRouter } from 'convex/server'
import { components, internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { registerRoutes } from '@convex-dev/stripe'
import type Stripe from 'stripe'
import type { Id } from './_generated/dataModel'
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
      const computerId = subscription.metadata?.computerId

      console.log(`[HTTP] customer.subscription.created: subId=${subscription.id}, computerId=${computerId ?? 'none'}, userId=${subscription.metadata?.userId ?? 'none'}`)

      // ── Computer subscription branch ──────────────────────────────────────
      if (computerId) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        console.log(`[HTTP] Computer branch: setting stripe info for computerId=${computerId}, subId=${subscription.id}, customerId=${customerId}`)
        await ctx.runMutation(internal.computers.setStripeInfo, {
          computerId: computerId as Id<'computers'>,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
        })
        console.log(`[HTTP] Stripe info saved. Triggering provisionComputer for computerId=${computerId}`)
        await ctx.runAction(internal.computers.provisionComputer, {
          computerId: computerId as Id<'computers'>,
        })
        console.log(`[HTTP] provisionComputer action returned for computerId=${computerId}`)
        return  // do NOT fall through to subscriptions table logic
      }
      // ── Existing Overlay subscription logic ───────────────────────────────

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
      const computerId = subscription.metadata?.computerId

      console.log(`[HTTP] customer.subscription.deleted: subId=${subscription.id}, computerId=${computerId ?? 'none'}, userId=${subscription.metadata?.userId ?? 'none'}`)

      // ── Computer subscription branch ──────────────────────────────────────
      if (computerId) {
        console.log(`[HTTP] Computer branch: triggering teardown for computerId=${computerId}`)
        await ctx.runAction(internal.computers.teardownComputer, {
          computerId: computerId as Id<'computers'>,
        })
        console.log(`[HTTP] teardownComputer action returned for computerId=${computerId}`)
        return
      }
      // ── Existing Overlay subscription logic ───────────────────────────────

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

      // ── Computer subscription branch ──────────────────────────────────────
      const rawSub = invoice.parent?.subscription_details?.subscription
      const subId = typeof rawSub === 'string' ? rawSub : rawSub?.id

      console.log(`[HTTP] invoice.payment_failed: resolved subId=${subId ?? 'none'}`)

      if (subId) {
        const computer = await ctx.runQuery(
          internal.computers.getByStripeSubscription,
          { stripeSubscriptionId: subId }
        )
        if (computer) {
          console.log(`[HTTP] Computer found for failed payment: computerId=${computer._id}, marking past_due`)
          await ctx.runMutation(internal.computers.setPastDue, {
            computerId: computer._id,
          })
          await ctx.runMutation(internal.computers.logEvent, {
            computerId: computer._id,
            type: 'payment_event',
            message: 'Payment failed. Computer will be deleted in 7 days.',
          })
          console.log(`[HTTP] Computer marked past_due for ${computer._id}`)
          return
        } else {
          console.log(`[HTTP] No computer found for subId=${subId}, falling through to user subscription logic`)
        }
      }
      // ── Existing Overlay subscription logic ───────────────────────────────

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

// VPS calls this once OpenClaw gateway is healthy — validates readySecret and flips status to ready
http.route({
  path: '/computer/ready',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    console.log('[HTTP] POST /computer/ready received')

    let body: { computerId?: string; readySecret?: string }
    try {
      body = await req.json()
    } catch {
      console.warn('[HTTP] /computer/ready: failed to parse JSON body')
      return new Response('Bad Request', { status: 400 })
    }

    const { computerId, readySecret } = body
    console.log(`[HTTP] /computer/ready: computerId=${computerId ?? 'missing'}, readySecret=${readySecret ? '[present]' : 'missing'}`)

    if (!computerId || !readySecret) {
      console.warn('[HTTP] /computer/ready: missing computerId or readySecret')
      return new Response('Missing computerId or readySecret', { status: 400 })
    }

    try {
      console.log(`[HTTP] /computer/ready: calling setReady for computerId=${computerId}`)
      await ctx.runMutation(internal.computers.setReady, {
        computerId: computerId as Id<'computers'>,
        readySecret,
      })
      await ctx.runMutation(internal.computers.logEvent, {
        computerId: computerId as Id<'computers'>,
        type: 'status_change',
        message: 'OpenClaw gateway is ready.',
      })
      console.log(`[HTTP] /computer/ready: success — computerId=${computerId} is now ready`)
      return new Response('OK', { status: 200 })
    } catch (err) {
      // Wrong secret or already deleted — reject
      console.error(`[HTTP] /computer/ready: setReady failed for computerId=${computerId}:`, err)
      return new Response('Unauthorized', { status: 401 })
    }
  }),
})

// VPS calls this to push installation progress logs to Convex (visible in dashboard)
http.route({
  path: '/computer/log',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    let body: { computerId?: string; message?: string }
    try {
      body = await req.json()
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const { computerId, message } = body
    if (!computerId || !message) {
      return new Response('Missing computerId or message', { status: 400 })
    }

    try {
      await ctx.runMutation(internal.computers.logEvent, {
        computerId: computerId as Id<'computers'>,
        type: 'provisioning_log',
        message,
      })
      console.log(`[HTTP] /computer/log: computerId=${computerId} — ${message}`)
      return new Response('OK', { status: 200 })
    } catch (err) {
      console.error(`[HTTP] /computer/log: failed for computerId=${computerId}:`, err)
      return new Response('Error', { status: 500 })
    }
  }),
})

export default http
