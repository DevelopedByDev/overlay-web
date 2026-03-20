import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const create = mutation({
  args: {
    userId: v.string(),
    type: v.union(v.literal('image'), v.literal('video')),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    prompt: v.string(),
    modelId: v.string(),
    url: v.optional(v.string()),
    chatId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('outputs', {
      ...args,
      createdAt: Date.now(),
      completedAt: args.status === 'completed' ? Date.now() : undefined,
    })
  },
})

export const update = mutation({
  args: {
    outputId: v.id('outputs'),
    status: v.optional(v.union(v.literal('pending'), v.literal('completed'), v.literal('failed'))),
    url: v.optional(v.string()),
    modelId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { outputId, status, url, modelId, errorMessage }) => {
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (url !== undefined) updates.url = url
    if (modelId !== undefined) updates.modelId = modelId
    if (errorMessage !== undefined) updates.errorMessage = errorMessage
    if (status === 'completed' || status === 'failed') updates.completedAt = Date.now()
    await ctx.db.patch(outputId, updates)
  },
})

export const get = query({
  args: { outputId: v.id('outputs') },
  handler: async (ctx, { outputId }) => {
    return await ctx.db.get(outputId)
  },
})

export const list = query({
  args: {
    userId: v.string(),
    type: v.optional(v.union(v.literal('image'), v.literal('video'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, type, limit }) => {
    const all = await ctx.db
      .query('outputs')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit ?? 100)

    if (type) return all.filter((o) => o.type === type)
    return all
  },
})

export const listByChatId = query({
  args: { chatId: v.string() },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query('outputs')
      .withIndex('by_chatId', (q) => q.eq('chatId', chatId))
      .order('desc')
      .collect()
  },
})
