import { v } from 'convex/values'
import { internalMutation, internalQuery, mutation } from '../_generated/server'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { requireServerSecret } from '../lib/auth'

const MAX_ATTEMPTS = 5
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
]

function nextAttemptDelayMs(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
}

function subscriptionMatchesEvent(events: string[], eventType: string): boolean {
  return events.includes(eventType) || events.includes('*')
}

export const enqueueByServer = mutation({
  args: {
    serverSecret: v.string(),
    userId: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    payloadJson: v.string(),
  },
  returns: v.object({ enqueued: v.number() }),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)

    const subscriptions = await ctx.db
      .query('webhookSubscriptions')
      .withIndex('by_userId_enabled', (q) => q.eq('userId', args.userId).eq('enabled', true))
      .collect()

    const now = Date.now()
    let enqueued = 0

    for (const subscription of subscriptions) {
      if (!subscriptionMatchesEvent(subscription.events, args.eventType)) continue

      const duplicate = await ctx.db
        .query('webhookDeliveries')
        .withIndex('by_subscriptionId_eventId', (q) =>
          q.eq('subscriptionId', subscription._id).eq('eventId', args.eventId),
        )
        .first()
      if (duplicate) continue

      await ctx.db.insert('webhookDeliveries', {
        userId: args.userId,
        subscriptionId: subscription._id,
        eventId: args.eventId,
        eventType: args.eventType,
        payloadJson: args.payloadJson,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      })
      enqueued += 1
    }

    return { enqueued }
  },
})

export const claimDueDeliveries = internalMutation({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.id('webhookDeliveries')),
  handler: async (ctx, args) => {
    const cappedLimit = Math.min(Math.max(args.limit ?? 25, 1), 100)
    const due = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status_nextAttemptAt', (q) =>
        q.eq('status', 'pending').lte('nextAttemptAt', args.now),
      )
      .take(cappedLimit)

    const claimed: Id<'webhookDeliveries'>[] = []
    for (const row of due) {
      await ctx.db.patch(row._id, {
        status: 'delivering',
        updatedAt: args.now,
      })
      claimed.push(row._id)
    }
    return claimed
  },
})

export const getDeliveryForExecution = internalQuery({
  args: {
    deliveryId: v.id('webhookDeliveries'),
  },
  returns: v.union(
    v.null(),
    v.object({
      deliveryId: v.id('webhookDeliveries'),
      url: v.string(),
      secret: v.string(),
      eventId: v.string(),
      eventType: v.string(),
      payloadJson: v.string(),
      attemptCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery || delivery.status !== 'delivering') return null

    const subscription = await ctx.db.get(delivery.subscriptionId)
    if (!subscription || !subscription.enabled) return null

    return {
      deliveryId: delivery._id,
      url: subscription.url,
      secret: subscription.secret,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      payloadJson: delivery.payloadJson,
      attemptCount: delivery.attemptCount,
    }
  },
})

export const markDelivered = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    statusCode: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery) return null

    await ctx.db.patch(delivery._id, {
      status: 'delivered',
      lastStatusCode: args.statusCode,
      deliveredAt: args.now,
      updatedAt: args.now,
    })
    return null
  },
})

export const markAttemptFailed = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    statusCode: v.optional(v.number()),
    error: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery) return null

    const attemptCount = delivery.attemptCount + 1
    const isDead = attemptCount >= MAX_ATTEMPTS
    await ctx.db.patch(delivery._id, {
      status: isDead ? 'dead' : 'pending',
      attemptCount,
      nextAttemptAt: isDead ? delivery.nextAttemptAt : args.now + nextAttemptDelayMs(attemptCount),
      lastError: args.error.slice(0, 1000),
      lastStatusCode: args.statusCode,
      updatedAt: args.now,
    })
    return null
  },
})

export const resetStuckDelivering = internalMutation({
  args: {
    now: v.number(),
    staleMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({ reset: v.number() }),
  handler: async (ctx, args) => {
    return resetStuckDeliveringRows(ctx, args.now, args.staleMs, args.limit)
  },
})

async function resetStuckDeliveringRows(
  ctx: MutationCtx,
  now: number,
  staleMs = 10 * 60_000,
  limit = 50,
): Promise<{ reset: number }> {
  const cutoff = now - staleMs
  const stuck = await ctx.db
    .query('webhookDeliveries')
    .withIndex('by_status_nextAttemptAt', (q) => q.eq('status', 'delivering'))
    .take(Math.min(Math.max(limit, 1), 200))

  let reset = 0
  for (const row of stuck) {
    if (row.updatedAt > cutoff) continue
    await ctx.db.patch(row._id, {
      status: 'pending',
      nextAttemptAt: now,
      updatedAt: now,
    })
    reset += 1
  }
  return { reset }
}
