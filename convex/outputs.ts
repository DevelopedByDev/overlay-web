import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import { applyStorageUsageDelta, ensureStorageAvailable } from './lib/storageQuota'

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

function buildProxyUrl(outputId: Id<'outputs'>): string {
  return `/api/app/outputs/${outputId}/content`
}

function isRenderableOutputType(type: string): type is 'image' | 'video' {
  return type === 'image' || type === 'video'
}

export const generateUploadUrl = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    sizeBytes: v.number(),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, sizeBytes }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    await ensureStorageAvailable(ctx as never, userId, sizeBytes)
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    type: v.union(v.literal('image'), v.literal('video')),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    prompt: v.string(),
    modelId: v.string(),
    storageId: v.optional(v.id('_storage')),
    sizeBytes: v.optional(v.number()),
    url: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    turnId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess({
      userId: args.userId,
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
    })
    const sizeBytes = Math.max(0, args.sizeBytes ?? 0)
    if (sizeBytes > 0) {
      await ensureStorageAvailable(ctx as never, args.userId, sizeBytes)
    }
    const id = await ctx.db.insert('outputs', {
      userId: args.userId,
      type: args.type,
      status: args.status,
      prompt: args.prompt,
      modelId: args.modelId,
      storageId: args.storageId,
      sizeBytes: sizeBytes || undefined,
      url: args.url,
      conversationId: args.conversationId,
      turnId: args.turnId,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
      completedAt: args.status === 'completed' ? Date.now() : undefined,
    })
    if (sizeBytes > 0) {
      await applyStorageUsageDelta(ctx as never, args.userId, sizeBytes)
    }
    return id
  },
})

export const update = mutation({
  args: {
    outputId: v.id('outputs'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    status: v.optional(v.union(v.literal('pending'), v.literal('completed'), v.literal('failed'))),
    storageId: v.optional(v.id('_storage')),
    sizeBytes: v.optional(v.number()),
    url: v.optional(v.string()),
    modelId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { outputId, userId, accessToken, serverSecret, status, storageId, sizeBytes, url, modelId, errorMessage }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const output = await ctx.db.get(outputId)
    if (!output || output.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const updates: Record<string, unknown> = {}
    const previousSizeBytes = output.sizeBytes ?? 0
    const nextSizeBytes = sizeBytes ?? previousSizeBytes
    const storageDelta = nextSizeBytes - previousSizeBytes
    if (storageDelta > 0) {
      await ensureStorageAvailable(ctx as never, userId, storageDelta)
    }
    if (status !== undefined) updates.status = status
    if (storageId !== undefined) updates.storageId = storageId
    if (sizeBytes !== undefined) updates.sizeBytes = sizeBytes
    if (url !== undefined) updates.url = url
    if (modelId !== undefined) updates.modelId = modelId
    if (errorMessage !== undefined) updates.errorMessage = errorMessage
    if (status === 'completed' || status === 'failed') updates.completedAt = Date.now()
    await ctx.db.patch(outputId, updates)
    if (storageDelta !== 0) {
      await applyStorageUsageDelta(ctx as never, userId, storageDelta)
    }
  },
})

export const get = query({
  args: { outputId: v.id('outputs'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { outputId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const output = await ctx.db.get(outputId)
    return output?.userId === userId && isRenderableOutputType(output.type)
      ? {
          ...output,
          url: output.storageId ? buildProxyUrl(output._id) : output.url,
        }
      : null
  },
})

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    type: v.optional(v.union(v.literal('image'), v.literal('video'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, type, limit }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const all = await ctx.db
      .query('outputs')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit ?? 100)

    const filtered = (type ? all.filter((o) => o.type === type) : all).filter((o) => isRenderableOutputType(o.type))
    return filtered.map((o) => ({
      ...o,
      url: o.storageId ? buildProxyUrl(o._id) : o.url,
    }))
  },
})

export const listByConversationId = query({
  args: { conversationId: v.string(), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const all = await ctx.db
      .query('outputs')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
      .order('desc')
      .collect()
    return all
      .filter((output) => output.userId === userId && isRenderableOutputType(output.type))
      .map((o) => ({ ...o, url: o.storageId ? buildProxyUrl(o._id) : o.url }))
  },
})

export const getStorageUrlForProxy = query({
  args: {
    outputId: v.id('outputs'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { outputId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const output = await ctx.db.get(outputId)
    if (!output || output.userId !== userId || !output.storageId || !isRenderableOutputType(output.type)) return null
    const url = await ctx.storage.getUrl(output.storageId)
    if (!url) return null
    return {
      url,
      sizeBytes: output.sizeBytes ?? 0,
      type: output.type,
    }
  },
})

export const deleteStorageObject = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, storageId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    await ctx.storage.delete(storageId)
    return { success: true }
  },
})
