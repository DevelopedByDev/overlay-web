import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'

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

// Alias for landing page API compatibility
export const getSubscription = getByUserId

// Get subscription by Stripe customer ID (for webhook lookups)
export const getByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return await ctx.db
      .query('subscriptions')
      .filter((q) => q.eq(q.field('stripeCustomerId'), stripeCustomerId))
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

// Downgrade user to free tier (for cancellation)
export const downgradeToFree = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        tier: 'free',
        status: 'canceled'
      })
      return { success: true }
    }

    return { success: false, error: 'Subscription not found' }
  }
})

// Alias for webhook compatibility - upsertSubscription maps to upsertFromStripe
// but with optional fields for partial updates
export const upsertSubscription = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    tier: v.optional(v.union(v.literal('free'), v.literal('pro'), v.literal('max'))),
    status: v.optional(
      v.union(
        v.literal('active'),
        v.literal('canceled'),
        v.literal('past_due'),
        v.literal('trialing')
      )
    ),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    autoRefillEnabled: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    const updateData: Record<string, unknown> = {}
    if (args.stripeCustomerId !== undefined) updateData.stripeCustomerId = args.stripeCustomerId
    if (args.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = args.stripeSubscriptionId
    if (args.tier !== undefined) updateData.tier = args.tier
    if (args.status !== undefined) updateData.status = args.status
    if (args.currentPeriodStart !== undefined) updateData.currentPeriodStart = args.currentPeriodStart
    if (args.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = args.currentPeriodEnd
    if (args.autoRefillEnabled !== undefined) updateData.autoRefillEnabled = args.autoRefillEnabled

    if (existing) {
      await ctx.db.patch(existing._id, updateData)
      return existing._id
    } else {
      return await ctx.db.insert('subscriptions', {
        userId: args.userId,
        stripeCustomerId: args.stripeCustomerId || '',
        stripeSubscriptionId: args.stripeSubscriptionId || '',
        tier: args.tier || 'free',
        status: args.status || 'active',
        currentPeriodStart: args.currentPeriodStart || 0,
        currentPeriodEnd: args.currentPeriodEnd || 0,
        autoRefillEnabled: args.autoRefillEnabled || false
      })
    }
  }
})

// Alias for auto-refill toggle compatibility
export const updateAutoRefill = setAutoRefill

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

// Internal mutations for webhook handlers (called from http.ts)
export const upsertFromStripeInternal = internalMutation({
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

export const updateStatusInternal = internalMutation({
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

      if (status === 'canceled') {
        await ctx.db.patch(subscription._id, { tier: 'free' })
      }

      return { success: true }
    }

    return { success: false, error: 'Subscription not found' }
  }
})

export const addRefillCreditsInternal = internalMutation({
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
