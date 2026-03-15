import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
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
    content: v.string(),
    source: v.union(v.literal('chat'), v.literal('note'), v.literal('manual')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('memories', { ...args, createdAt: Date.now() })
  },
})

export const remove = mutation({
  args: { memoryId: v.id('memories') },
  handler: async (ctx, { memoryId }) => {
    await ctx.db.delete(memoryId)
  },
})
