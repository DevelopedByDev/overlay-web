import { v } from 'convex/values'
import { mutation, query, internalMutation, internalQuery, type MutationCtx } from './_generated/server'
import { requireAccessToken, requireServerSecret, validateServerSecret } from './lib/auth'
import { logAuthDebug, summarizeJwtForLog } from './lib/authDebug'
import { FREE_TIER_AUTO_MODEL_ID } from '../src/lib/models'
import { getOrCreateSubscription, getStorageBytesUsed, getStorageLimitForSubscription } from './lib/storageQuota'
import { roundCurrencyAmount } from '../src/lib/daytona-pricing'

function getPastWeekDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
}

function countsTowardFreeTierMessageLimit(event: {
  type: 'ask' | 'write' | 'agent' | 'embedding' | 'transcription' | 'generation' | 'sandbox'
  modelId?: string
}): boolean {
  if (event.type !== 'ask' && event.type !== 'write' && event.type !== 'agent') return false
  return event.modelId !== FREE_TIER_AUTO_MODEL_ID
}

export type UsageEvent = {
  type: 'ask' | 'write' | 'agent' | 'embedding' | 'transcription' | 'generation' | 'sandbox'
  modelId?: string
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  cost: number
  timestamp: number
}

async function authorizeUserAccess(params: {
  accessToken?: string
  serverSecret?: string
  userId: string
}) {
  if (validateServerSecret(params.serverSecret)) {
    return
  }
  await requireAccessToken(params.accessToken ?? '', params.userId)
}

function roundCreditAmount(value: number): number {
  return roundCurrencyAmount(value)
}

export async function applyUsageEvents(
  ctx: MutationCtx,
  userId: string,
  events: UsageEvent[],
): Promise<{ success: true; eventsProcessed: number }> {
  const today = new Date().toISOString().split('T')[0]

  let dailyUsage = await ctx.db
    .query('dailyUsage')
    .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', today))
    .first()

  if (!dailyUsage) {
    const id = await ctx.db.insert('dailyUsage', {
      userId,
      date: today,
      askCount: 0,
      agentCount: 0,
      writeCount: 0,
      transcriptionSeconds: 0,
    })
    dailyUsage = await ctx.db.get(id)
  }

  let askDelta = 0
  let writeDelta = 0
  let agentDelta = 0
  let transcriptionSecondsDelta = 0

  for (const event of events) {
    if (countsTowardFreeTierMessageLimit(event)) {
      if (event.type === 'ask') askDelta++
      else if (event.type === 'write') writeDelta++
      else if (event.type === 'agent') agentDelta++
    } else if (event.type === 'transcription') {
      transcriptionSecondsDelta += Math.max(0, Math.round(event.cost))
    }
  }

  if (dailyUsage && (askDelta || writeDelta || agentDelta || transcriptionSecondsDelta)) {
    await ctx.db.patch(dailyUsage._id, {
      askCount: dailyUsage.askCount + askDelta,
      writeCount: dailyUsage.writeCount + writeDelta,
      agentCount: dailyUsage.agentCount + agentDelta,
      transcriptionSeconds: (dailyUsage.transcriptionSeconds ?? 0) + transcriptionSecondsDelta,
    })
  }

  let totalCost = 0
  let totalInputTokens = 0
  let totalCachedInputTokens = 0
  let totalOutputTokens = 0

  for (const event of events) {
    if (event.type !== 'transcription' && event.cost > 0) {
      totalCost = roundCreditAmount(totalCost + event.cost)
      totalInputTokens += event.inputTokens || 0
      totalCachedInputTokens += event.cachedTokens || 0
      totalOutputTokens += event.outputTokens || 0
    }
  }

  if (totalCost > 0) {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        creditsUsed: roundCreditAmount((subscription.creditsUsed ?? 0) + totalCost),
      })
    }

    const billingPeriodStart = subscription?.currentPeriodStart
      ? new Date(subscription.currentPeriodStart).toISOString().split('T')[0]
      : today

    let tokenUsage = await ctx.db
      .query('tokenUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', billingPeriodStart)
      )
      .first()

    if (!tokenUsage) {
      const id = await ctx.db.insert('tokenUsage', {
        userId,
        email: subscription?.email ?? '',
        billingPeriodStart,
        creditsUsed: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
      })
      tokenUsage = await ctx.db.get(id)
    } else if (!tokenUsage.email && subscription?.email) {
      await ctx.db.patch(tokenUsage._id, { email: subscription.email })
    }

    if (tokenUsage) {
      await ctx.db.patch(tokenUsage._id, {
        creditsUsed: roundCreditAmount((tokenUsage.creditsUsed ?? tokenUsage.costAccrued ?? 0) + totalCost),
        inputTokens: tokenUsage.inputTokens + totalInputTokens,
        cachedInputTokens: tokenUsage.cachedInputTokens + totalCachedInputTokens,
        outputTokens: tokenUsage.outputTokens + totalOutputTokens,
      })
    }
  }

  return { success: true, eventsProcessed: events.length }
}

// creditsUsed is now read directly from subscriptions (single source of truth).
// tokenUsage is queried only for the audit-log token counts shown on the account page.
export const getEntitlements = query({
  args: { accessToken: v.string(), userId: v.string() },
  handler: async (ctx, { accessToken, userId }) => {
    logAuthDebug('usage:getEntitlements start', {
      userId,
      accessToken: summarizeJwtForLog(accessToken),
    })
    await requireAccessToken(accessToken, userId)
    logAuthDebug('usage:getEntitlements access token verified', { userId })
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const today = new Date().toISOString().split('T')[0]
    const dailyUsage = await ctx.db
      .query('dailyUsage')
      .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', today))
      .first()

    const tier = subscription?.tier || 'free'

    const tierDefaults = {
      free: {
        creditsTotal: 0,
        dailyLimits: { ask: 15, write: 15, agent: 15 },
        transcriptionSecondsLimit: 600,
        localTranscriptionEnabled: false
      },
      pro: {
        creditsTotal: 15,
        dailyLimits: { ask: Infinity, write: Infinity, agent: Infinity },
        transcriptionSecondsLimit: Infinity,
        localTranscriptionEnabled: true
      },
      max: {
        creditsTotal: 90,
        dailyLimits: { ask: Infinity, write: Infinity, agent: Infinity },
        transcriptionSecondsLimit: Infinity,
        localTranscriptionEnabled: true
      }
    }

    const defaults = tierDefaults[tier]

    // Read creditsUsed from the subscription row directly — no billingPeriodStart
    // key lookup, so period drift can never cause a phantom reset to 0.
    const credits = subscription?.creditsUsed ?? 0

    let weeklyTranscriptionSeconds = 0
    let weeklyUsage = { ask: 0, write: 0, agent: 0 }

    if (tier === 'free') {
      const pastWeekDates = getPastWeekDates()
      const weeklyUsageRecords = await Promise.all(
        pastWeekDates.map(date =>
          ctx.db
            .query('dailyUsage')
            .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', date))
            .first()
        )
      )
      weeklyTranscriptionSeconds = weeklyUsageRecords.reduce(
        (sum, record) => sum + (record?.transcriptionSeconds ?? 0),
        0
      )
      weeklyUsage = weeklyUsageRecords.reduce(
        (acc, record) => ({
          ask: acc.ask + (record?.askCount ?? 0),
          write: acc.write + (record?.writeCount ?? 0),
          agent: acc.agent + (record?.agentCount ?? 0)
        }),
        { ask: 0, write: 0, agent: 0 }
      )
    }

    const result = {
      tier,
      creditsUsed: credits,
      creditsTotal: defaults.creditsTotal,
      overlayStorageBytesUsed: getStorageBytesUsed(subscription),
      overlayStorageBytesLimit: getStorageLimitForSubscription(subscription),
      dailyUsage: tier === 'free' ? weeklyUsage : {
        ask: dailyUsage?.askCount || 0,
        write: dailyUsage?.writeCount || 0,
        agent: dailyUsage?.agentCount || 0
      },
      dailyLimits: defaults.dailyLimits,
      transcriptionSecondsUsed: tier === 'free' ? weeklyTranscriptionSeconds : 0,
      transcriptionSecondsLimit: defaults.transcriptionSecondsLimit,
      localTranscriptionEnabled: defaults.localTranscriptionEnabled,
      resetAt: getNextWeeklyReset(),
      billingPeriodEnd: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString()
        : '',
      lastSyncedAt: Date.now()
    }
    logAuthDebug('usage:getEntitlements success', {
      userId,
      tier: result.tier,
    })
    return result
  }
})

export const getEntitlementsByServer = query({
  args: { serverSecret: v.string(), userId: v.string() },
  handler: async (ctx, { serverSecret, userId }) => {
    requireServerSecret(serverSecret)
    logAuthDebug('usage:getEntitlementsByServer start', { userId })
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const today = new Date().toISOString().split('T')[0]
    const dailyUsage = await ctx.db
      .query('dailyUsage')
      .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', today))
      .first()

    const tier = subscription?.tier || 'free'

    const tierDefaults = {
      free: {
        creditsTotal: 0,
        dailyLimits: { ask: 15, write: 15, agent: 15 },
        transcriptionSecondsLimit: 600,
        localTranscriptionEnabled: false
      },
      pro: {
        creditsTotal: 15,
        dailyLimits: { ask: Infinity, write: Infinity, agent: Infinity },
        transcriptionSecondsLimit: Infinity,
        localTranscriptionEnabled: true
      },
      max: {
        creditsTotal: 90,
        dailyLimits: { ask: Infinity, write: Infinity, agent: Infinity },
        transcriptionSecondsLimit: Infinity,
        localTranscriptionEnabled: true
      }
    }

    const defaults = tierDefaults[tier]
    const credits = subscription?.creditsUsed ?? 0

    let weeklyTranscriptionSeconds = 0
    let weeklyUsage = { ask: 0, write: 0, agent: 0 }

    if (tier === 'free') {
      const pastWeekDates = getPastWeekDates()
      const weeklyUsageRecords = await Promise.all(
        pastWeekDates.map(date =>
          ctx.db
            .query('dailyUsage')
            .withIndex('by_userId_date', (q) => q.eq('userId', userId).eq('date', date))
            .first()
        )
      )
      weeklyTranscriptionSeconds = weeklyUsageRecords.reduce(
        (sum, record) => sum + (record?.transcriptionSeconds ?? 0),
        0
      )
      weeklyUsage = weeklyUsageRecords.reduce(
        (acc, record) => ({
          ask: acc.ask + (record?.askCount ?? 0),
          write: acc.write + (record?.writeCount ?? 0),
          agent: acc.agent + (record?.agentCount ?? 0)
        }),
        { ask: 0, write: 0, agent: 0 }
      )
    }

    const result = {
      tier,
      creditsUsed: credits,
      creditsTotal: defaults.creditsTotal,
      overlayStorageBytesUsed: getStorageBytesUsed(subscription),
      overlayStorageBytesLimit: getStorageLimitForSubscription(subscription),
      dailyUsage: tier === 'free' ? weeklyUsage : {
        ask: dailyUsage?.askCount || 0,
        write: dailyUsage?.writeCount || 0,
        agent: dailyUsage?.agentCount || 0
      },
      dailyLimits: defaults.dailyLimits,
      transcriptionSecondsUsed: tier === 'free' ? weeklyTranscriptionSeconds : 0,
      transcriptionSecondsLimit: defaults.transcriptionSecondsLimit,
      localTranscriptionEnabled: defaults.localTranscriptionEnabled,
      resetAt: getNextWeeklyReset(),
      billingPeriodEnd: subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString()
        : '',
      lastSyncedAt: Date.now()
    }
    logAuthDebug('usage:getEntitlementsByServer success', {
      userId,
      tier: result.tier,
    })
    return result
  }
})

// Internal query for server-side credit enforcement (no access token needed).
export const getEntitlementsInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
    const tier = (subscription?.tier ?? 'free') as 'free' | 'pro' | 'max'
    const creditsTotalByTier: Record<string, number> = { free: 0, pro: 15, max: 90 }
    return {
      tier,
      creditsUsed: subscription?.creditsUsed ?? 0,
      creditsTotal: creditsTotalByTier[tier] ?? 0,
      overlayStorageBytesUsed: getStorageBytesUsed(subscription),
      overlayStorageBytesLimit: getStorageLimitForSubscription(subscription),
    }
  }
})

export const initializeSubscriptionUsageByServer = mutation({
  args: {
    serverSecret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { serverSecret, userId }) => {
    requireServerSecret(serverSecret)
    const subscription = await getOrCreateSubscription(ctx, userId)
    return {
      success: true,
      tier: subscription.tier,
      overlayStorageBytesUsed: getStorageBytesUsed(subscription),
    }
  },
})

// Record a batch of usage events — requires valid access token.
// Accumulates totals from all events and does a single patch to both
// subscriptions.creditsUsed (enforcement) and tokenUsage (audit log).
export const recordBatch = mutation({
  args: {
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    userId: v.string(),
    events: v.array(
      v.object({
        type: v.union(
          v.literal('ask'),
          v.literal('write'),
          v.literal('agent'),
          v.literal('embedding'),
          v.literal('transcription'),
          v.literal('generation'),
          v.literal('sandbox'),
        ),
        modelId: v.optional(v.string()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        cachedTokens: v.optional(v.number()),
        cost: v.number(),
        timestamp: v.number()
      })
    )
  },
  handler: async (ctx, { accessToken, serverSecret, userId, events }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    return await applyUsageEvents(ctx, userId, events)
  }
})

// Record a single usage event — requires valid access token
export const recordUsage = mutation({
  args: {
    accessToken: v.string(),
    userId: v.string(),
    type: v.union(
      v.literal('ask'),
      v.literal('write'),
      v.literal('agent'),
      v.literal('embedding'),
      v.literal('transcription'),
      v.literal('generation'),
      v.literal('sandbox'),
    ),
    modelId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    cost: v.number()
  },
  handler: async (ctx, args) => {
    await requireAccessToken(args.accessToken, args.userId)
    await applyUsageEvents(ctx, args.userId, [{
      type: args.type,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cachedTokens: args.cachedTokens,
      cost: args.cost,
      timestamp: Date.now(),
    }])
    return { success: true }
  }
})

// Reset token usage for new billing period — internal only (audit log housekeeping)
export const resetTokenUsage = internalMutation({
  args: {
    userId: v.string(),
    newPeriodStart: v.string()
  },
  handler: async (ctx, { userId, newPeriodStart }) => {
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    const existing = await ctx.db
      .query('tokenUsage')
      .withIndex('by_userId_period', (q) =>
        q.eq('userId', userId).eq('billingPeriodStart', newPeriodStart)
      )
      .first()

    if (!existing) {
      await ctx.db.insert('tokenUsage', {
        userId,
        email: subscription?.email ?? '',
        billingPeriodStart: newPeriodStart,
        creditsUsed: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0
      })
    }

    return { success: true, periodStart: newPeriodStart }
  }
})

function getNextWeeklyReset(): string {
  const now = new Date()
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  return nextMonday.toISOString()
}

/** Audit log for individual chat tool calls (Perplexity, generation, Composio, etc.). */
export const recordToolInvocation = mutation({
  args: {
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
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
      v.literal('daytona'),
      v.literal('composio'),
      v.literal('internal'),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess({
      userId: args.userId,
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
    })
    await ctx.db.insert('toolInvocations', {
      userId: args.userId,
      toolId: args.toolId.slice(0, 256),
      mode: args.mode,
      modelId: args.modelId?.slice(0, 256),
      conversationId: args.conversationId?.slice(0, 256),
      success: args.success,
      durationMs: args.durationMs,
      costBucket: args.costBucket,
      errorMessage: args.errorMessage?.slice(0, 2000),
      createdAt: Date.now(),
    })
    return { success: true }
  },
})
