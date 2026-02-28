import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Get subscription by userId
export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  }
})

// Create or update subscription from Stripe webhook
export const upsertFromStripe = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal('free'), v.literal('pro'), v.literal('max')),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('trialing')
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd
      })
      return existing._id
    } else {
      return await ctx.db.insert('subscriptions', {
        userId: args.userId,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        autoRefillEnabled: false
      })
    }
  }
})

// Update subscription status (for cancellation, etc.)
export const updateStatus = mutation({
  args: {
    userId: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('trialing')
    )
  },
  handler: async (ctx, { userId, status }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      await ctx.db.patch(subscription._id, { status })

      // If canceled, downgrade to free tier
      if (status === 'canceled') {
        await ctx.db.patch(subscription._id, { tier: 'free' })
      }

      return { success: true }
    }

    return { success: false, error: 'Subscription not found' }
  }
})

// Toggle auto-refill setting
export const setAutoRefill = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean()
  },
  handler: async (ctx, { userId, enabled }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      await ctx.db.patch(subscription._id, { autoRefillEnabled: enabled })
      return { success: true }
    }

    return { success: false, error: 'Subscription not found' }
  }
})

// Add refill credits after purchase
export const addRefillCredits = mutation({
  args: {
    userId: v.string(),
    credits: v.number(),
    stripePaymentIntentId: v.optional(v.string())
  },
  handler: async (ctx, { userId, credits, stripePaymentIntentId }) => {
    const existing = await ctx.db
      .query('refillCredits')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        creditsRemaining: existing.creditsRemaining + credits,
        purchasedAt: Date.now(),
        stripePaymentIntentId
      })
      return existing._id
    } else {
      return await ctx.db.insert('refillCredits', {
        userId,
        creditsRemaining: credits,
        purchasedAt: Date.now(),
        stripePaymentIntentId
      })
    }
  }
})

// Reset daily usage at midnight (called by scheduled job)
export const resetDailyUsage = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    // Get all daily usage records for the given date
    const usageRecords = await ctx.db
      .query('dailyUsage')
      .filter((q) => q.lt(q.field('date'), date))
      .collect()

    // Delete old records (keep only today's)
    let deleted = 0
    for (const record of usageRecords) {
      await ctx.db.delete(record._id)
      deleted++
    }

    return { deleted }
  }
})
