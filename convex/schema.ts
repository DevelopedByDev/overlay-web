import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // Single source of truth for a user's subscription, tier, and current-period credit spend.
  // creditsUsed is the live accumulator (in cents) mutated on every usage event.
  // currentPeriodStart/End are always set — on Stripe-backed subscriptions they come from
  // the webhook; on free tier they are set to now/+30d at account creation.
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
    // Live credit accumulator for the current billing period (in cents).
    // Reset to 0 whenever currentPeriodStart rolls over.
    creditsUsed: v.optional(v.number()),
    // User profile fields (synced from WorkOS)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    // Legacy field - kept for backward compatibility with existing data
    autoRefillEnabled: v.optional(v.boolean()),
  }).index('by_userId', ['userId'])
    .index('by_email', ['email']),

  // Append-only audit log: one row per billing period per user.
  // Written to on every usage batch for raw token counts and a credit snapshot.
  // Never read for enforcement — use subscriptions.creditsUsed for that.
  tokenUsage: defineTable({
    userId: v.string(),
    email: v.string(), // denormalized from subscriptions for easy dashboard filtering
    billingPeriodStart: v.string(), // ISO date string
    creditsUsed: v.optional(v.number()), // cents accumulated this period (audit copy)
    costAccrued: v.optional(v.number()), // legacy alias for creditsUsed
    inputTokens: v.number(),
    cachedInputTokens: v.number(),
    outputTokens: v.number()
  }).index('by_userId_period', ['userId', 'billingPeriodStart']),

  // Daily counters used exclusively for free-tier weekly limit enforcement.
  dailyUsage: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    askCount: v.number(),
    agentCount: v.number(),
    writeCount: v.number(),
    transcriptionSeconds: v.optional(v.number()),
    voiceChatCount: v.optional(v.number()),
    noteBrowserCount: v.optional(v.number()),
    browserSearchCount: v.optional(v.number()),
  }).index('by_userId_date', ['userId', 'date']),

  // Short-lived session transfer tokens for desktop app auth linking
  sessionTransferTokens: defineTable({
    token: v.string(),
    data: v.string(), // JSON-encoded auth data
    expiresAt: v.number(),
  }).index('by_token', ['token']),

  chats: defineTable({
    userId: v.string(),
    title: v.string(),
    folderId: v.optional(v.string()),
    lastModified: v.number(),
    model: v.string(),
  }).index('by_userId', ['userId']).index('by_userId_lastModified', ['userId', 'lastModified']),

  messages: defineTable({
    chatId: v.id('chats'),
    userId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    model: v.optional(v.string()),
    tokens: v.optional(v.object({ input: v.number(), output: v.number() })),
    createdAt: v.number(),
  }).index('by_chatId', ['chatId']).index('by_userId', ['userId']),

  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']).index('by_userId_updatedAt', ['userId', 'updatedAt']),

  memories: defineTable({
    userId: v.string(),
    content: v.string(),
    source: v.union(v.literal('chat'), v.literal('note'), v.literal('manual')),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  agents: defineTable({
    userId: v.string(),
    title: v.string(),
    lastModified: v.number(),
  }).index('by_userId', ['userId']).index('by_userId_lastModified', ['userId', 'lastModified']),

  agentMessages: defineTable({
    agentId: v.id('agents'),
    userId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    createdAt: v.number(),
  }).index('by_agentId', ['agentId']).index('by_userId', ['userId']),

  slackInstallations: defineTable({
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    botUserId: v.string(),
    installedBy: v.string(),
    installedAt: v.number(),
  }).index('by_teamId', ['teamId']),

  slackUserLinks: defineTable({
    slackUserId: v.string(),
    teamId: v.string(),
    overlayUserId: v.string(),
    linkedAt: v.number(),
  }).index('by_slack', ['slackUserId', 'teamId']).index('by_overlayUserId', ['overlayUserId']),

  slackConversations: defineTable({
    slackChannelId: v.string(),
    slackThreadTs: v.optional(v.string()),
    overlayUserId: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal('user'), v.literal('assistant')),
      content: v.string(),
      ts: v.string(),
    })),
    updatedAt: v.number(),
  }).index('by_channel_thread', ['slackChannelId', 'slackThreadTs']).index('by_overlayUserId', ['overlayUserId']),
})
