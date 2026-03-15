import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('notes')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(200)
  },
})

export const get = query({
  args: { noteId: v.id('notes') },
  handler: async (ctx, { noteId }) => {
    return await ctx.db.get(noteId)
  },
})

export const create = mutation({
  args: { userId: v.string(), title: v.string(), content: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db.insert('notes', { ...args, updatedAt: Date.now() })
  },
})

export const update = mutation({
  args: { noteId: v.id('notes'), title: v.optional(v.string()), content: v.optional(v.string()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, { noteId, ...updates }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.content !== undefined) patch.content = updates.content
    if (updates.tags !== undefined) patch.tags = updates.tags
    await ctx.db.patch(noteId, patch)
  },
})

export const remove = mutation({
  args: { noteId: v.id('notes') },
  handler: async (ctx, { noteId }) => {
    await ctx.db.delete(noteId)
  },
})
