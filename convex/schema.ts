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
      v.literal('composio'),
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
    token: v.string(),
    data: v.string(), // JSON-encoded auth data
    expiresAt: v.number(),
  }).index('by_token', ['token']),

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

  computers: defineTable({
    userId: v.string(),
    name: v.string(),
    setupType: v.literal('managed'),
    region: v.union(v.literal('eu-central'), v.literal('us-east')),

    // FSM status
    status: v.union(
      v.literal('pending_payment'),
      v.literal('provisioning'),
      v.literal('ready'),
      v.literal('error'),
      v.literal('past_due'),
      v.literal('deleted'),
    ),
    provisioningStep: v.optional(v.string()),
    // "creating_server" | "server_created" | "openclaw_starting"
    errorMessage: v.optional(v.string()),

    // Hetzner resources
    hetznerServerId: v.optional(v.number()),
    hetznerServerIp: v.optional(v.string()),
    hetznerFirewallId: v.optional(v.number()),

    // OpenClaw secrets — NEVER exposed outside owning userId
    gatewayToken: v.optional(v.string()),  // 64-char hex — sent to browser on status=ready
    readySecret: v.optional(v.string()),   // 32-char hex — baked into cloud-init, cleared after use

    // Billing timestamps
    pastDueAt: v.optional(v.number()),     // ms timestamp when past_due started (7-day calc)

    // Stripe — one subscription per computer
    stripeSubscriptionId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),

    // Latest known OpenClaw chat session state for the in-page computer chat.
    chatSessionKey: v.optional(v.string()),
    chatRequestedModelId: v.optional(v.string()),
    chatRequestedModelRef: v.optional(v.string()),
    chatEffectiveModel: v.optional(v.string()),
    chatEffectiveProvider: v.optional(v.string()),
    chatModelResolvedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_stripeSubscriptionId', ['stripeSubscriptionId']),

  computerEvents: defineTable({
    computerId: v.id('computers'),
    type: v.string(),    // "status_change" | "provision_log" | "error" | "payment_event"
    message: v.string(),
    createdAt: v.number(),
  }).index('by_computerId_createdAt', ['computerId', 'createdAt']),

  // Generated images and videos from Chat and Agent sessions.
  outputs: defineTable({
    userId: v.string(),
    type: v.union(v.literal('image'), v.literal('video')),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    prompt: v.string(),
    modelId: v.string(),
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
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
