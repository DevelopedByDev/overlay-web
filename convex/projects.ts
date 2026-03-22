import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('projects')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('asc')
      .collect()
  },
})

export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    return await ctx.db.get(projectId)
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, name, parentId }) => {
    const now = Date.now()
    return await ctx.db.insert('projects', { userId, name, parentId, createdAt: now, updatedAt: now })
  },
})

export const update = mutation({
  args: { projectId: v.id('projects'), name: v.optional(v.string()) },
  handler: async (ctx, { projectId, name }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (name !== undefined) patch.name = name
    await ctx.db.patch(projectId, patch)
  },
})

// Removes a single project and all its conversations/notes (no child-project cascade — handle that in the API layer).
export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const pid = projectId as string

    const [conversations, notes] = await Promise.all([
      ctx.db.query('conversations').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
      ctx.db.query('notes').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
    ])

    for (const conv of conversations) {
      const messages = await ctx.db
        .query('conversationMessages')
        .withIndex('by_conversationId', (q) => q.eq('conversationId', conv._id))
        .collect()
      for (const msg of messages) await ctx.db.delete(msg._id)
      const outputs = await ctx.db
        .query('outputs')
        .withIndex('by_conversationId', (q) => q.eq('conversationId', conv._id as string))
        .collect()
      for (const o of outputs) await ctx.db.delete(o._id)
      await ctx.db.delete(conv._id)
    }
    for (const note of notes) await ctx.db.delete(note._id)

    await ctx.db.delete(projectId)
  },
})
