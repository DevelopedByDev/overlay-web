import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Subscription information synced from Stripe
  subscriptions: defineTable({
    userId: v.string(),
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
    autoRefillEnabled: v.boolean()
  }).index('by_userId', ['userId']),

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
    transcriptionSeconds: v.optional(v.number()) // Optional for backward compatibility
  }).index('by_userId_date', ['userId', 'date']),

  // Refill credits (purchased separately from subscription)
  refillCredits: defineTable({
    userId: v.string(),
    creditsRemaining: v.number(),
    purchasedAt: v.number(), // Unix timestamp
    stripePaymentIntentId: v.optional(v.string())
  }).index('by_userId', ['userId']),

  // Individual usage events for detailed tracking and auditing
  usageEvents: defineTable({
    userId: v.string(),
    timestamp: v.number(), // Unix timestamp
    eventType: v.union(
      v.literal('ask'),
      v.literal('write'),
      v.literal('agent'),
      v.literal('transcription'),
      v.literal('tokens') // Legacy event type for backward compatibility
    ),
    modelId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    cachedInputTokens: v.optional(v.number()), // Legacy field name
    cost: v.optional(v.number()) // Cost in dollars (optional for backward compatibility)
  }).index('by_userId_timestamp', ['userId', 'timestamp'])
})
