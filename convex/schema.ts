import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Subscription information synced from Stripe
  subscriptions: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('pro'), v.literal('max')),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('past_due'),
      v.literal('trialing')
    ),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    // User profile fields (synced from WorkOS)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
  }).index('by_userId', ['userId'])
    .index('by_email', ['email']),

  // Token usage per billing period (aggregated)
  tokenUsage: defineTable({
    userId: v.string(),
    billingPeriodStart: v.string(), // ISO date string
    creditsUsed: v.optional(v.number()), // Total $ spent (new field)
    costAccrued: v.optional(v.number()), // Legacy field - same as creditsUsed
    inputTokens: v.number(),
    cachedInputTokens: v.number(),
    outputTokens: v.number()
  }).index('by_userId_period', ['userId', 'billingPeriodStart']),

  // Daily usage tracking for free tier limits
  dailyUsage: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    askCount: v.number(),
    agentCount: v.number(),
    writeCount: v.number(),
    transcriptionSeconds: v.optional(v.number()), // Optional for backward compatibility
    // Feature-specific usage (for account page stats)
    voiceChatCount: v.optional(v.number()),
    noteBrowserCount: v.optional(v.number()),
    browserSearchCount: v.optional(v.number()),
  }).index('by_userId_date', ['userId', 'date']),

  // Feature usage history (aggregated per billing period)
  featureUsage: defineTable({
    userId: v.string(),
    billingPeriodStart: v.string(), // ISO date string
    voiceChatMinutes: v.number(),
    notesCreated: v.number(),
    agentTasksRun: v.number(),
    browserSearches: v.number(),
    totalSessions: v.number(),
  }).index('by_userId_period', ['userId', 'billingPeriodStart']),

})
