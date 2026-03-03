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

// Get subscription by email (for cross-installation sync)
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
  }
})

// Link existing subscription to new userId (for reinstallation scenarios)
// This updates the userId on an existing subscription found by email
export const linkSubscriptionToUser = mutation({
  args: {
    email: v.string(),
    newUserId: v.string()
  },
  handler: async (ctx, { email, newUserId }) => {
    // First check if newUserId already has a subscription
    const existingByUserId = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', newUserId))
      .first()

    if (existingByUserId) {
      // User already has a subscription, no need to link
      return { success: true, action: 'already_linked', subscription: existingByUserId }
    }

    // Find subscription by email
    const subscriptionByEmail = await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()

    if (!subscriptionByEmail) {
      // No subscription found for this email
      return { success: false, action: 'not_found' }
    }

    // Update the subscription to use the new userId
    await ctx.db.patch(subscriptionByEmail._id, {
      userId: newUserId
    })

    return { success: true, action: 'linked', subscription: { ...subscriptionByEmail, userId: newUserId } }
  }
})

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
    email: v.optional(v.string()),
    name: v.optional(v.string()),
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
        email: args.email,
        name: args.name,
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
        email: args.email,
        name: args.name,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd
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
    email: v.optional(v.string()),
    name: v.optional(v.string()),
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
    currentPeriodEnd: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    const updateData: Record<string, unknown> = {}
    if (args.email !== undefined) updateData.email = args.email
    if (args.name !== undefined) updateData.name = args.name
    if (args.stripeCustomerId !== undefined) updateData.stripeCustomerId = args.stripeCustomerId
    if (args.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = args.stripeSubscriptionId
    if (args.tier !== undefined) updateData.tier = args.tier
    if (args.status !== undefined) updateData.status = args.status
    if (args.currentPeriodStart !== undefined) updateData.currentPeriodStart = args.currentPeriodStart
    if (args.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = args.currentPeriodEnd

    if (existing) {
      await ctx.db.patch(existing._id, updateData)
      return existing._id
    } else {
      return await ctx.db.insert('subscriptions', {
        userId: args.userId,
        email: args.email,
        name: args.name,
        stripeCustomerId: args.stripeCustomerId || '',
        stripeSubscriptionId: args.stripeSubscriptionId || '',
        tier: args.tier || 'free',
        status: args.status || 'active',
        currentPeriodStart: args.currentPeriodStart || 0,
        currentPeriodEnd: args.currentPeriodEnd || 0
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

// Internal mutations for webhook handlers (called from http.ts)
export const upsertFromStripeInternal = internalMutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
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
        email: args.email,
        name: args.name,
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
        email: args.email,
        name: args.name,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd
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

// Manual fix for subscriptions with NaN period values
export const fixSubscriptionPeriods = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    if (!subscription) {
      return { success: false, error: 'Subscription not found' }
    }

    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    await ctx.db.patch(subscription._id, {
      email: args.email || subscription.email,
      currentPeriodStart: args.currentPeriodStart || now,
      currentPeriodEnd: args.currentPeriodEnd || now + thirtyDays
    })

    return { success: true }
  }
})

