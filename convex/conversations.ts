import { v } from 'convex/values'
import { DEFAULT_MODEL_ID } from '../src/lib/models'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import { applyStorageUsageDelta } from './lib/storageQuota'

/** Matches AI SDK UI parts we persist; `tool-invocation` restores tool chips after reload. */
const messagePart = v.union(
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
)

const messageParts = v.optional(v.array(messagePart))

function clampAskModels(ids: string[]): string[] {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return [DEFAULT_MODEL_ID]
  return uniq.slice(0, 4)
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

function normalizeConversationDoc<T extends {
  updatedAt?: number
  lastModified: number
  createdAt: number
}>(conversation: T): T & { updatedAt: number } {
  return {
    ...conversation,
    updatedAt: conversation.updatedAt ?? conversation.lastModified ?? conversation.createdAt,
  }
}

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    updatedSince: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, updatedSince, includeDeleted }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const all = await ctx.db
      .query('conversations')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(200)
    return all
      .map(normalizeConversationDoc)
      .filter((c) => !c.projectId)
      .filter((c) => (updatedSince !== undefined ? c.updatedAt > updatedSince : true))
      .filter((c) => (includeDeleted ? true : !c.deletedAt))
      .slice(0, 100)
  },
})

export const listByProject = query({
  args: {
    projectId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    updatedSince: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret, updatedSince, includeDeleted }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
      .order('desc')
      .collect()
    return conversations
      .map(normalizeConversationDoc)
      .filter((conversation) => conversation.userId === userId)
      .filter((conversation) => (updatedSince !== undefined ? conversation.updatedAt > updatedSince : true))
      .filter((conversation) => (includeDeleted ? true : !conversation.deletedAt))
  },
})

export const get = query({
  args: { conversationId: v.id('conversations'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const conversation = await ctx.db.get(conversationId)
    return conversation?.userId === userId && !conversation.deletedAt
      ? normalizeConversationDoc(conversation)
      : null
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    clientId: v.optional(v.string()),
    title: v.string(),
    projectId: v.optional(v.string()),
    askModelIds: v.optional(v.array(v.string())),
    actModelId: v.optional(v.string()),
    lastMode: v.optional(v.union(v.literal('ask'), v.literal('act'))),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, clientId, title, projectId, askModelIds, actModelId, lastMode }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (clientId?.trim()) {
      const existing = await ctx.db
        .query('conversations')
        .withIndex('by_userId_clientId', (q) => q.eq('userId', userId).eq('clientId', clientId.trim()))
        .first()
      if (existing) {
        return existing._id
      }
    }
    if (projectId) {
      const project = await ctx.db.get(projectId as Id<'projects'>)
      if (!project || project.userId !== userId || project.deletedAt) {
        throw new Error('Unauthorized')
      }
    }
    const ask = clampAskModels(askModelIds ?? [DEFAULT_MODEL_ID])
    const act = actModelId?.trim() || ask[0] || DEFAULT_MODEL_ID
    const now = Date.now()
    return await ctx.db.insert('conversations', {
      userId,
      clientId: clientId?.trim() || undefined,
      title,
      projectId,
      lastModified: now,
      createdAt: now,
      updatedAt: now,
      lastMode: lastMode ?? 'ask',
      askModelIds: ask,
      actModelId: act,
    })
  },
})

export const update = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    conversationId: v.id('conversations'),
    title: v.optional(v.string()),
    projectId: v.optional(v.string()),
    askModelIds: v.optional(v.array(v.string())),
    actModelId: v.optional(v.string()),
    lastMode: v.optional(v.union(v.literal('ask'), v.literal('act'))),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, conversationId, title, projectId, askModelIds, actModelId, lastMode }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const conversation = await ctx.db.get(conversationId)
    if (!conversation || conversation.userId !== userId || conversation.deletedAt) {
      throw new Error('Unauthorized')
    }
    if (projectId !== undefined && projectId !== null) {
      const project = await ctx.db.get(projectId as Id<'projects'>)
      if (!project || project.userId !== userId || project.deletedAt) {
        throw new Error('Unauthorized')
      }
    }
    const now = Date.now()
    const updates: Record<string, unknown> = { lastModified: now, updatedAt: now }
    if (title !== undefined) updates.title = title
    if (projectId !== undefined) updates.projectId = projectId || undefined
    if (askModelIds !== undefined) updates.askModelIds = clampAskModels(askModelIds)
    if (actModelId !== undefined) updates.actModelId = actModelId
    if (lastMode !== undefined) updates.lastMode = lastMode
    await ctx.db.patch(conversationId, updates)
  },
})

export const remove = mutation({
  args: { conversationId: v.id('conversations'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const conversation = await ctx.db.get(conversationId)
    if (!conversation || conversation.userId !== userId || conversation.deletedAt) {
      throw new Error('Unauthorized')
    }
    const now = Date.now()
    await ctx.db.patch(conversationId, {
      deletedAt: now,
      updatedAt: now,
      lastModified: now,
    })
  },
})

export const getMessages = query({
  args: { conversationId: v.id('conversations'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const conversation = await ctx.db.get(conversationId)
    if (!conversation || conversation.userId !== userId || conversation.deletedAt) {
      return []
    }
    return await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
      .order('asc')
      .collect()
  },
})

export const addMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    turnId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    mode: v.union(v.literal('ask'), v.literal('act')),
    content: v.string(),
    contentType: v.union(v.literal('text'), v.literal('image'), v.literal('video')),
    parts: messageParts,
    modelId: v.optional(v.string()),
    variantIndex: v.optional(v.number()),
    tokens: v.optional(v.object({ input: v.number(), output: v.number() })),
    replyToTurnId: v.optional(v.string()),
    replySnippet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess({
      userId: args.userId,
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
    })
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation || conversation.userId !== args.userId || conversation.deletedAt) {
      throw new Error('Unauthorized')
    }
    const existing = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', args.conversationId))
      .collect()
    const match = existing.find(
      (message) =>
        message.turnId === args.turnId &&
        message.role === args.role &&
        (message.variantIndex ?? 0) === (args.variantIndex ?? 0),
    )
    const now = Date.now()
    const payload = {
      conversationId: args.conversationId,
      userId: args.userId,
      turnId: args.turnId,
      role: args.role,
      mode: args.mode,
      content: args.content,
      contentType: args.contentType,
      parts: args.parts,
      modelId: args.modelId,
      variantIndex: args.variantIndex,
      tokens: args.tokens,
      replyToTurnId: args.replyToTurnId,
      replySnippet: args.replySnippet,
      createdAt: match?.createdAt ?? now,
    }
    const msgId = match
      ? (await ctx.db.patch(match._id, payload), match._id)
      : await ctx.db.insert('conversationMessages', payload)
    await ctx.db.patch(args.conversationId, { lastModified: now, updatedAt: now })
    return msgId
  },
})

/** Batch insert for Ask multi-model assistant variants (same turn). */
/** Remove one user turn and all associated assistant variants (same turnId), plus matching outputs. */
export const deleteTurn = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    turnId: v.string(),
  },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret, turnId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const conv = await ctx.db.get(conversationId)
    if (!conv || conv.userId !== userId || conv.deletedAt) {
      throw new Error('Unauthorized')
    }
    const tid = turnId.trim()
    if (!tid) return { deletedMessages: 0, deletedOutputs: 0 }

    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
      .collect()

    let deletedMessages = 0
    for (const m of messages) {
      if (m.turnId === tid) {
        await ctx.db.delete(m._id)
        deletedMessages++
      }
    }

    const cid = conversationId as string
    const outputs = await ctx.db
      .query('outputs')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', cid))
      .collect()

    let deletedOutputs = 0
    for (const o of outputs) {
      if (o.turnId === tid && o.userId === userId) {
        if (o.storageId) {
          try {
            await ctx.storage.delete(o.storageId)
          } catch {
            // best-effort
          }
        }
        if (o.sizeBytes) {
          await applyStorageUsageDelta(ctx as never, userId, -o.sizeBytes)
        }
        await ctx.db.delete(o._id)
        deletedOutputs++
      }
    }

    const now = Date.now()
    await ctx.db.patch(conversationId, { lastModified: now, updatedAt: now })
    return { deletedMessages, deletedOutputs }
  },
})

export const addMessages = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    rows: v.array(v.object({
      turnId: v.string(),
      role: v.union(v.literal('user'), v.literal('assistant')),
      mode: v.union(v.literal('ask'), v.literal('act')),
      content: v.string(),
      contentType: v.union(v.literal('text'), v.literal('image'), v.literal('video')),
      parts: messageParts,
      modelId: v.optional(v.string()),
      variantIndex: v.optional(v.number()),
      tokens: v.optional(v.object({ input: v.number(), output: v.number() })),
    })),
  },
  handler: async (ctx, { conversationId, userId, accessToken, serverSecret, rows }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const conversation = await ctx.db.get(conversationId)
    if (!conversation || conversation.userId !== userId || conversation.deletedAt) {
      throw new Error('Unauthorized')
    }
    const now = Date.now()
    const ids: Id<'conversationMessages'>[] = []
    for (const row of rows) {
      const existing = await ctx.db
        .query('conversationMessages')
        .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
        .collect()
      const match = existing.find(
        (message) =>
          message.turnId === row.turnId &&
          message.role === row.role &&
          (message.variantIndex ?? 0) === (row.variantIndex ?? 0),
      )
      const payload = {
        conversationId,
        userId,
        createdAt: match?.createdAt ?? now,
        ...row,
      }
      const id = match
        ? (await ctx.db.patch(match._id, payload), match._id)
        : await ctx.db.insert('conversationMessages', payload)
      ids.push(id)
    }
    await ctx.db.patch(conversationId, { lastModified: now, updatedAt: now })
    return ids
  },
})
