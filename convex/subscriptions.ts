import { v } from 'convex/values'
import { mutation, query, internalMutation, internalQuery } from './_generated/server'

function validateAccessToken(accessToken: string): boolean {
  if (!accessToken || typeof accessToken !== 'string') return false
  const trimmed = accessToken.trim()
  if (trimmed.length < 20) return false
  const parts = trimmed.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      )
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
        return false
      }
    } catch {
      // Accept as opaque token
    }
  }
  return true
}

// Get subscription by userId
export const getByUserId = query({
  args: { accessToken: v.string(), userId: v.string() },
  handler: async (ctx, { accessToken, userId }) => {
    if (!validateAccessToken(accessToken)) return null
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  }
})

// Alias for landing page API compatibility
export const getSubscription = getByUserId

// Internal query for server-side ownership checks (used by stripe.ts actions)
export const getByUserIdInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  }
})

// Get subscription by email (for cross-installation sync)
export const getByEmail = query({
  args: { accessToken: v.string(), email: v.string() },
  handler: async (ctx, { accessToken, email }) => {
    if (!validateAccessToken(accessToken)) return null
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
  }
})

// Link existing subscription to new userId (for reinstallation scenarios)
export const linkSubscriptionToUser = internalMutation({
  args: {
    email: v.string(),
    newUserId: v.string()
  },
  handler: async (ctx, { email, newUserId }) => {
    const existingByUserId = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', newUserId))
      .first()

    if (existingByUserId) {
      return { success: true, action: 'already_linked', subscription: existingByUserId }
    }

    const subscriptionByEmail = await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()

    if (!subscriptionByEmail) {
      return { success: false, action: 'not_found' }
    }

    await ctx.db.patch(subscriptionByEmail._id, {
      userId: newUserId
    })

    return { success: true, action: 'linked', subscription: { ...subscriptionByEmail, userId: newUserId } }
  }
})

// Get subscription by Stripe customer ID (for webhook lookups — internal only)
export const getByStripeCustomerId = query({
  args: { accessToken: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, { accessToken, stripeCustomerId }) => {
    if (!validateAccessToken(accessToken)) return null
    return await ctx.db
      .query('subscriptions')
      .filter((q) => q.eq(q.field('stripeCustomerId'), stripeCustomerId))
      .first()
  }
})

// Server-side only: validate the internal secret before allowing mutation
function validateServerSecret(secret: string | undefined): boolean {
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected || !secret) return false
  return secret === expected
}

// Upsert subscription — requires server secret (called from authenticated Next.js routes)
export const upsertSubscription = mutation({
  args: {
    serverSecret: v.string(),
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
    if (!validateServerSecret(args.serverSecret)) {
      throw new Error('Unauthorized: invalid server secret')
    }

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

// Update subscription status — internal only
export const updateStatus = internalMutation({
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

// Downgrade user to free tier — requires server secret
export const downgradeToFree = mutation({
  args: {
    serverSecret: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { serverSecret, userId }) => {
    if (!validateServerSecret(serverSecret)) {
      throw new Error('Unauthorized: invalid server secret')
    }

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

// Reset daily usage — internal only (called by scheduled job)
export const resetDailyUsage = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const usageRecords = await ctx.db
      .query('dailyUsage')
      .filter((q) => q.lt(q.field('date'), date))
      .collect()

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

// Fix subscription periods — internal only (admin use)
export const fixSubscriptionPeriods = internalMutation({
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
