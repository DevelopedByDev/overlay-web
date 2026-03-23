import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

const messageParts = v.optional(v.array(v.object({
  type: v.string(),
  text: v.optional(v.string()),
  url: v.optional(v.string()),
  mediaType: v.optional(v.string()),
})))

function clampAskModels(ids: string[]): string[] {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return ['claude-sonnet-4-6']
  return uniq.slice(0, 4)
}

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query('conversations')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(200)
    return all.filter((c) => !c.projectId).slice(0, 100)
  },
})

export const listByProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query('conversations')
      .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db.get(conversationId)
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    projectId: v.optional(v.string()),
    askModelIds: v.optional(v.array(v.string())),
    actModelId: v.optional(v.string()),
    lastMode: v.optional(v.union(v.literal('ask'), v.literal('act'))),
  },
  handler: async (ctx, { userId, title, projectId, askModelIds, actModelId, lastMode }) => {
    const ask = clampAskModels(askModelIds ?? ['claude-sonnet-4-6'])
    const act = actModelId?.trim() || ask[0] || 'claude-sonnet-4-6'
    const now = Date.now()
    return await ctx.db.insert('conversations', {
      userId,
      title,
      projectId,
      lastModified: now,
      createdAt: now,
      lastMode: lastMode ?? 'ask',
      askModelIds: ask,
      actModelId: act,
    })
  },
})

export const update = mutation({
  args: {
    conversationId: v.id('conversations'),
    title: v.optional(v.string()),
    askModelIds: v.optional(v.array(v.string())),
    actModelId: v.optional(v.string()),
    lastMode: v.optional(v.union(v.literal('ask'), v.literal('act'))),
  },
  handler: async (ctx, { conversationId, title, askModelIds, actModelId, lastMode }) => {
    const updates: Record<string, unknown> = { lastModified: Date.now() }
    if (title !== undefined) updates.title = title
    if (askModelIds !== undefined) updates.askModelIds = clampAskModels(askModelIds)
    if (actModelId !== undefined) updates.actModelId = actModelId
    if (lastMode !== undefined) updates.lastMode = lastMode
    await ctx.db.patch(conversationId, updates)
  },
})

export const remove = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const cid = conversationId as string
    const messages = await ctx.db
      .query('conversationMessages')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', conversationId))
      .collect()
    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }
    const outputs = await ctx.db
      .query('outputs')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', cid))
      .collect()
    for (const o of outputs) {
      await ctx.db.delete(o._id)
    }
    await ctx.db.delete(conversationId)
  },
})

export const getMessages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
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
    const msgId = await ctx.db.insert('conversationMessages', {
      ...args,
      createdAt: Date.now(),
    })
    await ctx.db.patch(args.conversationId, { lastModified: Date.now() })
    return msgId
  },
})

/** Batch insert for Ask multi-model assistant variants (same turn). */
/** Remove one user turn and all associated assistant variants (same turnId), plus matching outputs. */
export const deleteTurn = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
    turnId: v.string(),
  },
  handler: async (ctx, { conversationId, userId, turnId }) => {
    const conv = await ctx.db.get(conversationId)
    if (!conv || conv.userId !== userId) {
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
        await ctx.db.delete(o._id)
        deletedOutputs++
      }
    }

    await ctx.db.patch(conversationId, { lastModified: Date.now() })
    return { deletedMessages, deletedOutputs }
  },
})

export const addMessages = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
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
  handler: async (ctx, { conversationId, userId, rows }) => {
    const now = Date.now()
    const ids: Id<'conversationMessages'>[] = []
    for (const row of rows) {
      const id = await ctx.db.insert('conversationMessages', {
        conversationId,
        userId,
        createdAt: now,
        ...row,
      })
      ids.push(id)
    }
    await ctx.db.patch(conversationId, { lastModified: now })
    return ids
  },
})
