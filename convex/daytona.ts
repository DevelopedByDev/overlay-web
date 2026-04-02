import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAccessToken, requireServerSecret, validateServerSecret } from './lib/auth'
import {
  computeDaytonaRuntimeCost,
  roundCurrencyAmount,
} from '../src/lib/daytona-pricing'
import { applyUsageEvents } from './usage'

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

export const getWorkspaceByUserId = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }

    return await ctx.db
      .query('daytonaWorkspaces')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()
  },
})

export const getWorkspaceBySandboxId = query({
  args: {
    sandboxId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { sandboxId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }

    const workspace = await ctx.db
      .query('daytonaWorkspaces')
      .withIndex('by_sandboxId', (q) => q.eq('sandboxId', sandboxId))
      .first()

    return workspace?.userId === userId ? workspace : null
  },
})

export const upsertWorkspace = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    sandboxId: v.string(),
    sandboxName: v.string(),
    volumeId: v.string(),
    volumeName: v.string(),
    tier: v.union(v.literal('pro'), v.literal('max')),
    state: v.union(
      v.literal('provisioning'),
      v.literal('started'),
      v.literal('stopped'),
      v.literal('archived'),
      v.literal('error'),
      v.literal('missing'),
    ),
    resourceProfile: v.union(v.literal('pro'), v.literal('max')),
    mountPath: v.string(),
    lastMeteredAt: v.optional(v.number()),
    lastKnownStartedAt: v.optional(v.number()),
    lastKnownStoppedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess({
      userId: args.userId,
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
    })

    const now = Date.now()
    const existing = await ctx.db
      .query('daytonaWorkspaces')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    const patch = {
      sandboxId: args.sandboxId,
      sandboxName: args.sandboxName,
      volumeId: args.volumeId,
      volumeName: args.volumeName,
      tier: args.tier,
      state: args.state,
      resourceProfile: args.resourceProfile,
      mountPath: args.mountPath,
      lastMeteredAt: args.lastMeteredAt,
      lastKnownStartedAt: args.lastKnownStartedAt,
      lastKnownStoppedAt: args.lastKnownStoppedAt,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
      return {
        ...existing,
        ...patch,
      }
    }

    const id = await ctx.db.insert('daytonaWorkspaces', {
      userId: args.userId,
      ...patch,
      createdAt: now,
    })

    return await ctx.db.get(id)
  },
})

export const markWorkspaceState = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    state: v.union(
      v.literal('provisioning'),
      v.literal('started'),
      v.literal('stopped'),
      v.literal('archived'),
      v.literal('error'),
      v.literal('missing'),
    ),
    lastMeteredAt: v.optional(v.number()),
    lastKnownStartedAt: v.optional(v.number()),
    lastKnownStoppedAt: v.optional(v.number()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, ...updates }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })

    const workspace = await ctx.db
      .query('daytonaWorkspaces')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (!workspace) return null

    const patch = {
      ...updates,
      updatedAt: Date.now(),
    }

    await ctx.db.patch(workspace._id, patch)
    return {
      ...workspace,
      ...patch,
    }
  },
})

export const recordUsageLedger = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    sandboxId: v.string(),
    tier: v.union(v.literal('pro'), v.literal('max')),
    resourceProfile: v.union(v.literal('pro'), v.literal('max')),
    startedAt: v.number(),
    endedAt: v.number(),
    durationSeconds: v.number(),
    cpu: v.number(),
    memoryGiB: v.number(),
    diskGiB: v.number(),
    costUsd: v.number(),
    costCents: v.number(),
    reason: v.union(
      v.literal('start'),
      v.literal('task'),
      v.literal('stop'),
      v.literal('archive'),
      v.literal('resize'),
      v.literal('reconcile'),
    ),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess({
      userId: args.userId,
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
    })

    return await ctx.db.insert('daytonaUsageLedger', {
      ...args,
      costUsd: roundCurrencyAmount(args.costUsd),
      costCents: roundCurrencyAmount(args.costCents),
      createdAt: Date.now(),
    })
  },
})

export const accrueUsageByServer = mutation({
  args: {
    serverSecret: v.string(),
    userId: v.string(),
    sandboxId: v.string(),
    tier: v.union(v.literal('pro'), v.literal('max')),
    resourceProfile: v.union(v.literal('pro'), v.literal('max')),
    startedAt: v.number(),
    endedAt: v.number(),
    cpu: v.number(),
    memoryGiB: v.number(),
    diskGiB: v.number(),
    reason: v.union(
      v.literal('start'),
      v.literal('task'),
      v.literal('stop'),
      v.literal('archive'),
      v.literal('resize'),
      v.literal('reconcile'),
    ),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)

    const durationSeconds = Math.max(0, (args.endedAt - args.startedAt) / 1000)
    const { costUsd, costCents } = computeDaytonaRuntimeCost({
      cpu: args.cpu,
      memoryGiB: args.memoryGiB,
      diskGiB: args.diskGiB,
      elapsedSeconds: durationSeconds,
    })

    if (durationSeconds > 0) {
      await ctx.db.insert('daytonaUsageLedger', {
        userId: args.userId,
        sandboxId: args.sandboxId,
        tier: args.tier,
        resourceProfile: args.resourceProfile,
        startedAt: args.startedAt,
        endedAt: args.endedAt,
        durationSeconds: roundCurrencyAmount(durationSeconds),
        cpu: args.cpu,
        memoryGiB: args.memoryGiB,
        diskGiB: args.diskGiB,
        costUsd,
        costCents,
        reason: args.reason,
        createdAt: Date.now(),
      })

      await applyUsageEvents(ctx, args.userId, [{
        type: 'sandbox',
        cost: costCents,
        timestamp: args.endedAt,
      }])
    }

    const workspace = await ctx.db
      .query('daytonaWorkspaces')
      .withIndex('by_sandboxId', (q) => q.eq('sandboxId', args.sandboxId))
      .first()

    if (workspace) {
      await ctx.db.patch(workspace._id, {
        lastMeteredAt: args.endedAt,
        updatedAt: Date.now(),
      })
    }

    return {
      success: true,
      durationSeconds: roundCurrencyAmount(durationSeconds),
      costUsd,
      costCents,
    }
  },
})
