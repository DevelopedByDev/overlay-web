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
    // Legacy fields kept only so older rows continue to validate during deploys.
    autoRefillEnabled: v.optional(v.boolean()),
    overlayStorageBytesUsed: v.optional(v.number()),
    fileBandwidthBytesUsed: v.optional(v.number()),
    fileBandwidthPeriodStart: v.optional(v.number()),
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

  /** One row per tool invocation (audit / cost-class tracking for chat tools). */
  toolInvocations: defineTable({
    userId: v.string(),
    toolId: v.string(),
    mode: v.union(v.literal('ask'), v.literal('act')),
    modelId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    success: v.boolean(),
    durationMs: v.optional(v.number()),
    costBucket: v.union(
      v.literal('perplexity'),
      v.literal('image'),
      v.literal('video'),
      v.literal('browser'),
      v.literal('composio'),
      v.literal('daytona'),
      v.literal('internal'),
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_userId_toolId', ['userId', 'toolId']),

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
    tokenHash: v.optional(v.string()),
    token: v.optional(v.string()),
    codeChallenge: v.optional(v.string()),
    data: v.string(), // JSON-encoded auth data
    expiresAt: v.number(),
  })
    .index('by_tokenHash', ['tokenHash']),

  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  skills: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.string(),
    instructions: v.string(),
    projectId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']).index('by_projectId', ['projectId']),

  conversations: defineTable({
    userId: v.string(),
    title: v.string(),
    projectId: v.optional(v.string()),
    lastModified: v.number(),
    createdAt: v.number(),
    lastMode: v.union(v.literal('ask'), v.literal('act')),
    askModelIds: v.array(v.string()),
    actModelId: v.string(),
  }).index('by_userId', ['userId'])
    .index('by_userId_lastModified', ['userId', 'lastModified'])
    .index('by_projectId', ['projectId']),

  conversationMessages: defineTable({
    conversationId: v.id('conversations'),
    userId: v.string(),
    turnId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    mode: v.union(v.literal('ask'), v.literal('act')),
    content: v.string(),
    contentType: v.union(v.literal('text'), v.literal('image'), v.literal('video')),
    parts: v.optional(
      v.array(
        v.union(
          v.object({
            type: v.literal('tool-invocation'),
            toolInvocation: v.object({
              toolCallId: v.optional(v.string()),
              toolName: v.string(),
              state: v.optional(v.string()),
              toolInput: v.optional(v.any()),
              toolOutput: v.optional(v.any()),
            }),
          }),
          v.object({
            type: v.string(),
            text: v.optional(v.string()),
            url: v.optional(v.string()),
            mediaType: v.optional(v.string()),
          }),
        ),
      ),
    ),
    modelId: v.optional(v.string()),
    variantIndex: v.optional(v.number()),
    tokens: v.optional(v.object({ input: v.number(), output: v.number() })),
    /** User message: optional thread reply target (assistant / exchange turn). */
    replyToTurnId: v.optional(v.string()),
    replySnippet: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_conversationId', ['conversationId'])
    .index('by_userId', ['userId']),

  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    projectId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_userId', ['userId'])
    .index('by_userId_updatedAt', ['userId', 'updatedAt'])
    .index('by_projectId', ['projectId']),

  memories: defineTable({
    userId: v.string(),
    content: v.string(),
    source: v.union(v.literal('chat'), v.literal('note'), v.literal('manual')),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  // Searchable chunks for hybrid vector + full-text retrieval (files + memories).
  knowledgeChunks: defineTable({
    userId: v.string(),
    projectId: v.optional(v.string()),
    sourceKind: v.union(v.literal('file'), v.literal('memory')),
    sourceId: v.string(),
    chunkIndex: v.number(),
    startOffset: v.number(),
    text: v.string(),
    title: v.optional(v.string()),
  })
    .index('by_source', ['sourceKind', 'sourceId'])
    .index('by_userId', ['userId'])
    .searchIndex('search_text', {
      searchField: 'text',
      filterFields: ['userId', 'sourceKind'],
    }),

  // Embeddings stored separately so routine reads avoid loading large vectors.
  knowledgeChunkEmbeddings: defineTable({
    chunkId: v.id('knowledgeChunks'),
    userId: v.string(),
    sourceKind: v.union(v.literal('file'), v.literal('memory')),
    embedding: v.array(v.float64()),
  })
    .index('by_chunkId', ['chunkId'])
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['userId', 'sourceKind'],
    }),

  // Generated images and videos from Chat and Agent sessions.
  outputs: defineTable({
    userId: v.string(),
    // Legacy deployments may still contain older text/document output rows.
    // Keep them schema-compatible, but runtime output surfaces only use image/video.
    type: v.union(v.literal('text'), v.literal('document'), v.literal('image'), v.literal('video')),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    prompt: v.string(),
    modelId: v.string(),
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
    conversationId: v.optional(v.string()),
    turnId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index('by_userId', ['userId'])
    .index('by_userId_createdAt', ['userId', 'createdAt'])
    .index('by_conversationId', ['conversationId']),

  // Knowledge base and project files. Text content is stored in `content`;
  // binary files (images, PDFs, audio, video) are stored in Convex File Storage
  // and referenced via `storageId` — the serving URL is resolved at query time.
  files: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal('file'), v.literal('folder')),
    parentId: v.optional(v.string()),
    content: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    projectId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId'])
    .index('by_projectId', ['projectId'])
    .index('by_parentId', ['parentId']),
})
