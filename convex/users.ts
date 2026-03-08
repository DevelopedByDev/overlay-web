import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

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

// Sync user profile from auth system (called after login).
// For new users, always sets currentPeriodStart/End so the billingPeriodStart
// key in tokenUsage never falls back to "today" and drifts between sessions.
export const syncUserProfile = mutation({
  args: {
    accessToken: v.string(),
    userId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, { accessToken, userId, email, firstName, lastName, profilePictureUrl }) => {
    if (!validateAccessToken(accessToken)) {
      throw new Error('Unauthorized: invalid or expired access token')
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      const patch: Record<string, unknown> = {
        email,
        firstName,
        lastName,
        profilePictureUrl,
        lastLoginAt: Date.now(),
      }

      // Backfill period timestamps for legacy rows that were created without them
      if (!existing.currentPeriodStart || existing.currentPeriodStart === 0) {
        const now = Date.now()
        patch.currentPeriodStart = now
        patch.currentPeriodEnd = now + 30 * 24 * 60 * 60 * 1000
      }
      if (existing.creditsUsed === undefined || existing.creditsUsed === null) {
        patch.creditsUsed = 0
      }

      await ctx.db.patch(existing._id, patch)
      return { success: true, isNewUser: false }
    } else {
      const now = Date.now()
      await ctx.db.insert('subscriptions', {
        userId,
        email,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName || email,
        firstName,
        lastName,
        profilePictureUrl,
        tier: 'free',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        creditsUsed: 0,
        lastLoginAt: now,
      })
      return { success: true, isNewUser: true }
    }
  },
})

// Get user profile with subscription and usage data (for account page).
// creditsUsed is read from the subscription row directly — no tokenUsage join needed.
export const getUserProfile = query({
  args: { accessToken: v.string(), userId: v.string() },
  handler: async (ctx, { accessToken, userId }) => {
    if (!validateAccessToken(accessToken)) {
      return null
    }

    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!subscription) {
      return null
    }

    const today = new Date().toISOString().split('T')[0]

    const dailyUsage = await ctx.db
      .query('dailyUsage')
      .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', today))
      .first()

    // Fetch the audit-log tokenUsage row for raw token counts (display only)
    const billingPeriodStart = subscription.currentPeriodStart
      ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
      : today

    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
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
      },
      usage: {
        // creditsUsed comes from subscription — single source of truth
        creditsUsed: subscription.creditsUsed ?? 0,
        creditsTotal: subscription.tier === 'free' ? 0 : subscription.tier === 'pro' ? 15 : 90,
        // Raw token counts from audit log (may lag slightly behind creditsUsed)
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
    }
  },
})
