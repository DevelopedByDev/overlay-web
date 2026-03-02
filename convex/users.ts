import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

// Sync user profile from auth system (called after login)
export const syncUserProfile = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, { userId, email, firstName, lastName, profilePictureUrl }) => {
    // Check if subscription record exists
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      // Update existing record with profile info
      await ctx.db.patch(existing._id, {
        email,
        firstName,
        lastName,
        profilePictureUrl,
        lastLoginAt: Date.now(),
      })
      return { success: true, isNewUser: false }
    } else {
      // Create new subscription record with free tier
      await ctx.db.insert('subscriptions', {
        userId,
        email,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName || email,
        firstName,
        lastName,
        profilePictureUrl,
        tier: 'free',
        status: 'active',
        autoRefillEnabled: false,
        lastLoginAt: Date.now(),
      })
      return { success: true, isNewUser: true }
    }
  },
})

// Get user profile with subscription and usage data (for account page)
export const getUserProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Get subscription
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!subscription) {
      return null
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Get daily usage
    const dailyUsage = await ctx.db
      .query('dailyUsage')
      .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', today))
      .first()

    // Get billing period usage
    const billingPeriodStart = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
      : today

    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
      .first()

    // Get feature usage
    const featureUsage = await ctx.db
      .query('featureUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
      .first()

    // Get refill credits
    const refillCredits = await ctx.db
      .query('refillCredits')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    return {
      profile: {
        userId: subscription.userId,
        email: subscription.email,
        name: subscription.name,
        firstName: subscription.firstName,
        lastName: subscription.lastName,
        profilePictureUrl: subscription.profilePictureUrl,
        lastLoginAt: subscription.lastLoginAt,
      },
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        autoRefillEnabled: subscription.autoRefillEnabled,
        autoRefillAmount: subscription.autoRefillAmount,
      },
      usage: {
        creditsUsed: tokenUsage?.creditsUsed ?? tokenUsage?.costAccrued ?? 0,
        creditsTotal: subscription.tier === 'free' ? 0 : subscription.tier === 'pro' ? 15 : 90,
        refillCredits: refillCredits?.creditsRemaining ?? 0,
        inputTokens: tokenUsage?.inputTokens ?? 0,
        outputTokens: tokenUsage?.outputTokens ?? 0,
        cachedInputTokens: tokenUsage?.cachedInputTokens ?? 0,
      },
      dailyUsage: {
        askCount: dailyUsage?.askCount ?? 0,
        writeCount: dailyUsage?.writeCount ?? 0,
        agentCount: dailyUsage?.agentCount ?? 0,
        transcriptionSeconds: dailyUsage?.transcriptionSeconds ?? 0,
        voiceChatCount: dailyUsage?.voiceChatCount ?? 0,
        noteBrowserCount: dailyUsage?.noteBrowserCount ?? 0,
        browserSearchCount: dailyUsage?.browserSearchCount ?? 0,
      },
      featureUsage: {
        voiceChatMinutes: featureUsage?.voiceChatMinutes ?? 0,
        notesCreated: featureUsage?.notesCreated ?? 0,
        agentTasksRun: featureUsage?.agentTasksRun ?? 0,
        browserSearches: featureUsage?.browserSearches ?? 0,
        totalSessions: featureUsage?.totalSessions ?? 0,
      },
    }
  },
})

// Record feature usage (called from desktop app)
export const recordFeatureUsage = mutation({
  args: {
    userId: v.string(),
    feature: v.union(
      v.literal('voice_chat'),
      v.literal('note'),
      v.literal('agent'),
      v.literal('browser_search'),
      v.literal('session')
    ),
    value: v.number(), // minutes for voice_chat, count for others
  },
  handler: async (ctx, { userId, feature, value }) => {
    // Get subscription for billing period
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const today = new Date().toISOString().split('T')[0]
    const billingPeriodStart = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
      : today

    // Get or create feature usage record
    let featureUsage = await ctx.db
      .query('featureUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
      .first()

    if (!featureUsage) {
      const id = await ctx.db.insert('featureUsage', {
        userId,
        billingPeriodStart,
        voiceChatMinutes: 0,
        notesCreated: 0,
        agentTasksRun: 0,
        browserSearches: 0,
        totalSessions: 0,
      })
      featureUsage = await ctx.db.get(id)
    }

    if (!featureUsage) return { success: false }

    // Update the appropriate field
    switch (feature) {
      case 'voice_chat':
        await ctx.db.patch(featureUsage._id, {
          voiceChatMinutes: featureUsage.voiceChatMinutes + value,
        })
        break
      case 'note':
        await ctx.db.patch(featureUsage._id, {
          notesCreated: featureUsage.notesCreated + value,
        })
        break
      case 'agent':
        await ctx.db.patch(featureUsage._id, {
          agentTasksRun: featureUsage.agentTasksRun + value,
        })
        break
      case 'browser_search':
        await ctx.db.patch(featureUsage._id, {
          browserSearches: featureUsage.browserSearches + value,
        })
        break
      case 'session':
        await ctx.db.patch(featureUsage._id, {
          totalSessions: featureUsage.totalSessions + value,
        })
        break
    }

    return { success: true }
  },
})
