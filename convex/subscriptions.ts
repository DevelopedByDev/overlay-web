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
    currentPeriodEnd: v.optional(v.number()),
    autoRefillEnabled: v.optional(v.boolean())
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
    if (args.autoRefillEnabled !== undefined) updateData.autoRefillEnabled = args.autoRefillEnabled

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

// Check and trigger auto-refill if needed
export const checkAutoRefill = internalMutation({
  args: {
    userId: v.string()
  },
  handler: async (ctx, { userId }) => {
    // Get subscription
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!subscription || !subscription.autoRefillEnabled || !subscription.autoRefillAmount) {
      return { triggered: false, reason: 'Auto-refill not enabled or no amount set' }
    }

    if (subscription.tier === 'free') {
      return { triggered: false, reason: 'Free tier' }
    }

    if (!subscription.stripeCustomerId) {
      return { triggered: false, reason: 'No Stripe customer ID' }
    }

    // Get current usage
    const billingPeriodStart = subscription.currentPeriodStart
      ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
      .first()

    // Get refill credits
    const refillCredits = await ctx.db
      .query('refillCredits')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    // Calculate current credits state
    const creditsTotal = subscription.tier === 'max' ? 90 : 15
    const creditsUsed = tokenUsage?.creditsUsed ?? tokenUsage?.costAccrued ?? 0
    const refillBalance = refillCredits?.creditsRemaining ?? 0
    const creditsRemaining = Math.max(0, creditsTotal - creditsUsed) + refillBalance

    // Check if below 10% threshold
    const threshold = creditsTotal * 0.1
    
    if (creditsRemaining > threshold) {
      return { triggered: false, reason: 'Credits above threshold', creditsRemaining, threshold }
    }

    // Schedule the auto-refill action
    const amount = subscription.autoRefillAmount
    const credits = amount * 0.9 // 10% margin

    // Return data for the action to be scheduled
    return {
      triggered: true,
      shouldCharge: true,
      userId,
      stripeCustomerId: subscription.stripeCustomerId,
      amount,
      credits,
      creditsRemaining,
      threshold
    }
  }
})

// Update auto-refill settings
export const updateAutoRefillInternal = internalMutation({
  args: {
    userId: v.string(),
    autoRefillEnabled: v.boolean(),
    autoRefillAmount: v.optional(v.number())
  },
  handler: async (ctx, { userId, autoRefillEnabled, autoRefillAmount }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      const updateData: Record<string, unknown> = { autoRefillEnabled }
      if (autoRefillAmount !== undefined) {
        updateData.autoRefillAmount = autoRefillAmount
      }
      await ctx.db.patch(subscription._id, updateData)
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
