import { v } from 'convex/values'
import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { getVerifiedAccessTokenClaims, requireAccessToken, requireServerSecret } from './lib/auth'

// Returns true if the new period start represents a different billing cycle
// than what is currently stored, indicating credits should be reset.
function isPeriodRollover(existingPeriodStart: number | undefined, newPeriodStart: number): boolean {
  if (!existingPeriodStart || existingPeriodStart === 0) return false
  // Compare calendar dates (YYYY-MM-DD) so that small ms-level differences
  // from repeated webhook deliveries don't incorrectly trigger a reset.
  const existingDate = new Date(existingPeriodStart).toISOString().split('T')[0]
  const newDate = new Date(newPeriodStart).toISOString().split('T')[0]
  return existingDate !== newDate
}

// Get subscription by userId
export const getByUserId = query({
  args: { accessToken: v.string(), userId: v.string() },
  handler: async (ctx, { accessToken, userId }) => {
    try {
      await requireAccessToken(accessToken, userId)
    } catch {
      return null
    }
    return await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  }
})

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
    const claims = await getVerifiedAccessTokenClaims(accessToken)
    if (!claims) return null
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first()
    return subscription?.userId === claims.sub ? subscription : null
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
    const claims = await getVerifiedAccessTokenClaims(accessToken)
    if (!claims) return null
    const subscription = await ctx.db
      .query('subscriptions')
      .filter((q) => q.eq(q.field('stripeCustomerId'), stripeCustomerId))
      .first()
    return subscription?.userId === claims.sub ? subscription : null
  }
})

// Upsert subscription — requires server secret (called from authenticated Next.js routes).
// On period rollover (new currentPeriodStart differs from stored), creditsUsed is reset to 0.
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
    requireServerSecret(args.serverSecret)

    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    if (existing) {
      const updateData: Record<string, unknown> = {}
      if (args.email !== undefined) updateData.email = args.email
      if (args.name !== undefined) updateData.name = args.name
      if (args.stripeCustomerId !== undefined) updateData.stripeCustomerId = args.stripeCustomerId
      if (args.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = args.stripeSubscriptionId
      if (args.tier !== undefined) updateData.tier = args.tier
      if (args.status !== undefined) updateData.status = args.status
      if (args.currentPeriodStart !== undefined) updateData.currentPeriodStart = args.currentPeriodStart
      if (args.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = args.currentPeriodEnd

      // Reset credits when the billing period rolls over
      if (
        args.currentPeriodStart !== undefined &&
        isPeriodRollover(existing.currentPeriodStart, args.currentPeriodStart)
      ) {
        updateData.creditsUsed = 0
        updateData.fileBandwidthBytesUsed = 0
        updateData.fileBandwidthPeriodStart = args.currentPeriodStart
      }

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
        currentPeriodStart: args.currentPeriodStart || now,
        currentPeriodEnd: args.currentPeriodEnd || now + thirtyDays,
        creditsUsed: 0,
        overlayStorageBytesUsed: 0,
        fileBandwidthBytesUsed: 0,
        fileBandwidthPeriodStart: args.currentPeriodStart || now,
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
      const patch: Record<string, unknown> = { status }
      if (status === 'canceled') {
        patch.tier = 'free'
      }
      await ctx.db.patch(subscription._id, patch)
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
    requireServerSecret(serverSecret)

    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      const now = Date.now()
      await ctx.db.patch(subscription._id, {
        tier: 'free',
        status: 'canceled',
        creditsUsed: 0,
        fileBandwidthBytesUsed: 0,
        fileBandwidthPeriodStart: now,
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000
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

// Upsert from Stripe webhook data — internal only (called from http.ts webhook handler).
// Detects period rollover by comparing currentPeriodStart dates and resets creditsUsed to 0
// when the billing cycle changes (monthly renewal or plan upgrade/downgrade).
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
      const periodRolled = isPeriodRollover(existing.currentPeriodStart, args.currentPeriodStart)

      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        tier: args.tier,
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        // Reset credit counter on period rollover (monthly renewal or plan change)
        creditsUsed: periodRolled ? 0 : (existing.creditsUsed ?? 0),
        fileBandwidthBytesUsed: periodRolled ? 0 : (existing.fileBandwidthBytesUsed ?? 0),
        fileBandwidthPeriodStart: args.currentPeriodStart,
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
        creditsUsed: 0,
        overlayStorageBytesUsed: 0,
        fileBandwidthBytesUsed: 0,
        fileBandwidthPeriodStart: args.currentPeriodStart,
      })
    }
  }
})

// One-time migration: backfills creditsUsed and period timestamps for all existing
// subscription rows that pre-date this schema change.
// Run via Convex CLI (handles auth automatically):
//   npx convex run subscriptions:migrateToCreditsOnSubscription --prod
export const migrateToCreditsOnSubscription = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allSubscriptions = await ctx.db.query('subscriptions').collect()
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    let migrated = 0

    for (const sub of allSubscriptions) {
      const updates: Record<string, unknown> = {}

      // Ensure period timestamps are always populated
      const periodStart = sub.currentPeriodStart && sub.currentPeriodStart > 0
        ? sub.currentPeriodStart
        : now

      if (!sub.currentPeriodStart || sub.currentPeriodStart === 0) {
        updates.currentPeriodStart = periodStart
      }
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd === 0) {
        updates.currentPeriodEnd = periodStart + thirtyDays
      }

      // Backfill creditsUsed from the corresponding tokenUsage row if available
      if (sub.creditsUsed === undefined || sub.creditsUsed === null) {
        const billingPeriodStart = new Date(periodStart).toISOString().split('T')[0]
        const tokenUsage = await ctx.db
          .query('tokenUsage')
          .withIndex('by_userId_period', (q) =>
            q.eq('userId', sub.userId).eq('billingPeriodStart', billingPeriodStart)
          )
          .first()

        updates.creditsUsed = tokenUsage?.creditsUsed ?? tokenUsage?.costAccrued ?? 0
      }

      if (sub.overlayStorageBytesUsed === undefined || sub.overlayStorageBytesUsed === null) {
        updates.overlayStorageBytesUsed = 0
      }
      if (sub.fileBandwidthBytesUsed === undefined || sub.fileBandwidthBytesUsed === null) {
        updates.fileBandwidthBytesUsed = 0
      }
      if (sub.fileBandwidthPeriodStart === undefined || sub.fileBandwidthPeriodStart === null) {
        updates.fileBandwidthPeriodStart = periodStart
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(sub._id, updates)
        migrated++
      }
    }

    return { migrated, total: allSubscriptions.length }
  }
})

// Backfill email onto all existing tokenUsage rows that pre-date the email field.
// Run via Convex CLI: npx convex run subscriptions:backfillTokenUsageEmail [--prod]
export const backfillTokenUsageEmail = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allTokenUsage = await ctx.db.query('tokenUsage').collect()

    let migrated = 0

    for (const row of allTokenUsage) {
      if (row.email) continue // already has email

      const subscription = await ctx.db
        .query('subscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', row.userId))
        .first()

      await ctx.db.patch(row._id, { email: subscription?.email ?? '' })
      migrated++
    }

    return { migrated, total: allTokenUsage.length }
  }
})
