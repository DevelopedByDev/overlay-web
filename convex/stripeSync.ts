'use node'

import Stripe from 'stripe'
import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import {
  extractCustomerInfo,
  getSubscriptionPeriodMs,
  mapPriceToTier,
  mapSubscriptionStatus,
} from './lib/stripeOverlaySubscription'

const SYNC_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

async function listAllSubscriptions(
  stripe: Stripe,
  status: Stripe.Subscription.Status
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let startingAfter: string | undefined
  while (true) {
    const page = await stripe.subscriptions.list({
      status,
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.customer'],
    })
    out.push(...page.data)
    if (!page.has_more) break
    const last = page.data[page.data.length - 1]
    if (!last) break
    startingAfter = last.id
  }
  return out
}

/**
 * One-off / ops: pull Overlay (non-computer) subscriptions from Stripe and
 * upsert into `subscriptions` — same fields as the Stripe webhook path.
 *
 * Run on prod: `npx convex run stripeSync:syncPaidSubscriptionsFromStripe --prod`
 *
 * Requires `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_MAX_PRICE_ID` in Convex env.
 * Skips subscriptions without `metadata.userId` (set in Checkout); skips computer subs (`metadata.computerId`).
 */
export const syncPaidSubscriptionsFromStripe = internalAction({
  args: {},
  returns: v.object({
    synced: v.number(),
    skipped: v.number(),
    results: v.array(
      v.object({
        subscriptionId: v.string(),
        customerId: v.optional(v.string()),
        userId: v.optional(v.string()),
        outcome: v.union(v.literal('synced'), v.literal('skipped')),
        reason: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx) => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set in Convex environment')
    }

    const stripe = new Stripe(key)
    const results: Array<{
      subscriptionId: string
      customerId?: string
      userId?: string
      outcome: 'synced' | 'skipped'
      reason?: string
    }> = []

    let synced = 0
    let skipped = 0

    for (const status of SYNC_STATUSES) {
      const subs = await listAllSubscriptions(stripe, status)
      for (const subscription of subs) {
        const subscriptionId = subscription.id
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id

        if (subscription.metadata?.computerId) {
          skipped++
          results.push({
            subscriptionId,
            customerId,
            outcome: 'skipped',
            reason: 'computer subscription (metadata.computerId)',
          })
          continue
        }

        const userId = subscription.metadata?.userId?.trim()
        if (!userId) {
          skipped++
          results.push({
            subscriptionId,
            customerId,
            outcome: 'skipped',
            reason: 'missing metadata.userId (WorkOS user id from checkout)',
          })
          continue
        }

        const priceId = subscription.items.data[0]?.price?.id
        const tier = mapPriceToTier(priceId)
        if (tier === 'free') {
          skipped++
          results.push({
            subscriptionId,
            customerId,
            userId,
            outcome: 'skipped',
            reason: `unknown or unset price id (${priceId ?? 'none'}) — check STRIPE_PRO_PRICE_ID / STRIPE_MAX_PRICE_ID`,
          })
          continue
        }

        const customerInfo = extractCustomerInfo(
          subscription.customer as Stripe.Customer | string
        )
        const email = subscription.metadata?.email || customerInfo.email
        const name = customerInfo.name

        const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodMs(subscription)

        await ctx.runMutation(internal.subscriptions.upsertFromStripeInternal, {
          userId,
          email,
          name,
          stripeCustomerId:
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          tier,
          status: mapSubscriptionStatus(subscription.status),
          currentPeriodStart,
          currentPeriodEnd,
        })

        synced++
        results.push({
          subscriptionId,
          customerId,
          userId,
          outcome: 'synced',
        })
      }
    }

    return { synced, skipped, results }
  },
})
