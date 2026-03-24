import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireAccessToken, validateServerSecret } from './lib/auth'

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

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    return await ctx.db
      .query('memories')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(100)
  },
})

export const add = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal('chat'), v.literal('note'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const memoryId = await ctx.db.insert('memories', {
      userId: args.userId,
      content: args.content,
      source: args.source,
      createdAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.knowledge.reindexMemoryInternal, { memoryId })
    return memoryId
  },
})

export const update = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    memoryId: v.id('memories'),
    content: v.string(),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, memoryId, content }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(memoryId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.patch(memoryId, { content })
    await ctx.scheduler.runAfter(0, internal.knowledge.reindexMemoryInternal, { memoryId })
  },
})

export const remove = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    memoryId: v.id('memories'),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, memoryId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(memoryId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
      sourceKind: 'memory',
      sourceId: memoryId,
    })
    await ctx.db.delete(memoryId)
  },
})
