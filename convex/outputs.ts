import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import { classifyOutputType } from '../src/lib/output-types'

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

export const generateUploadUrl = mutation({
  args: { userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    return await ctx.storage.generateUploadUrl()
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    type: v.union(
      v.literal('image'),
      v.literal('video'),
      v.literal('audio'),
      v.literal('document'),
      v.literal('archive'),
      v.literal('code'),
      v.literal('text'),
      v.literal('other'),
    ),
    source: v.optional(
      v.union(
        v.literal('image_generation'),
        v.literal('video_generation'),
        v.literal('sandbox'),
      ),
    ),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    prompt: v.string(),
    modelId: v.string(),
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    metadata: v.optional(v.any()),
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
    return await ctx.db.insert('outputs', {
      userId: args.userId,
      type: args.type,
      source:
        args.source ??
        (args.type === 'image'
          ? 'image_generation'
          : args.type === 'video'
          ? 'video_generation'
          : 'sandbox'),
      status: args.status,
      prompt: args.prompt,
      modelId: args.modelId,
      storageId: args.storageId,
      url: args.url,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      metadata: args.metadata,
      conversationId: args.conversationId,
      turnId: args.turnId,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
      completedAt: args.status === 'completed' ? Date.now() : undefined,
    })
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
    url: v.optional(v.string()),
    modelId: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal('image_generation'),
        v.literal('video_generation'),
        v.literal('sandbox'),
      ),
    ),
    type: v.optional(
      v.union(
        v.literal('image'),
        v.literal('video'),
        v.literal('audio'),
        v.literal('document'),
        v.literal('archive'),
        v.literal('code'),
        v.literal('text'),
        v.literal('other'),
      ),
    ),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { outputId, userId, accessToken, serverSecret, status, storageId, url, modelId, source, type, fileName, mimeType, sizeBytes, metadata, errorMessage }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const output = await ctx.db.get(outputId)
    if (!output || output.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (storageId !== undefined) updates.storageId = storageId
    if (url !== undefined) updates.url = url
    if (modelId !== undefined) updates.modelId = modelId
    if (source !== undefined) updates.source = source
    if (type !== undefined) updates.type = type
    if (fileName !== undefined) updates.fileName = fileName
    if (mimeType !== undefined) updates.mimeType = mimeType
    if (sizeBytes !== undefined) updates.sizeBytes = sizeBytes
    if (metadata !== undefined) updates.metadata = metadata
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
  args: { outputId: v.id('outputs'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { outputId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const output = await ctx.db.get(outputId)
    if (!output || output.userId !== userId) return null
    return {
      ...output,
      type:
        output.fileName || output.mimeType
          ? classifyOutputType(output.fileName, output.mimeType)
          : output.type,
      url: await resolveUrl(ctx, output),
    }
  },
})

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal('image'),
        v.literal('video'),
        v.literal('audio'),
        v.literal('document'),
        v.literal('archive'),
        v.literal('code'),
        v.literal('text'),
        v.literal('other'),
      ),
    ),
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

    const filtered = type ? all.filter((o) => o.type === type) : all
    return await Promise.all(
      filtered.map(async (o) => ({
        ...o,
        type:
          o.fileName || o.mimeType
            ? classifyOutputType(o.fileName, o.mimeType)
            : o.type,
        url: await resolveUrl(ctx, o),
      }))
    )
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
    return await Promise.all(
      all
        .filter((output) => output.userId === userId)
        .map(async (o) => ({
          ...o,
          type:
            o.fileName || o.mimeType
              ? classifyOutputType(o.fileName, o.mimeType)
              : o.type,
          url: await resolveUrl(ctx, o),
        }))
    )
  },
})
