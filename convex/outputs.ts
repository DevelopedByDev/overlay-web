import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: {
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
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    modelId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { outputId, status, storageId, url, modelId, errorMessage }) => {
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (storageId !== undefined) updates.storageId = storageId
    if (url !== undefined) updates.url = url
    if (modelId !== undefined) updates.modelId = modelId
    if (errorMessage !== undefined) updates.errorMessage = errorMessage
    if (status === 'completed' || status === 'failed') updates.completedAt = Date.now()
    await ctx.db.patch(outputId, updates)
  },
})

async function resolveUrl(ctx: { storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } }, output: { storageId?: Id<'_storage'>; url?: string }): Promise<string | undefined> {
  if (output.storageId) {
    const served = await ctx.storage.getUrl(output.storageId)
    return served ?? undefined
  }
  return output.url
}

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

    const filtered = type ? all.filter((o) => o.type === type) : all
    return await Promise.all(
      filtered.map(async (o) => ({ ...o, url: await resolveUrl(ctx, o) }))
    )
  },
})

export const listByConversationId = query({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const all = await ctx.db
      .query('outputs')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .collect()
    return await Promise.all(
      all.map(async (o) => ({ ...o, url: await resolveUrl(ctx, o) }))
    )
  },
})
