import { v } from 'convex/values'
import { mutation } from './_generated/server'

export const storeToken = mutation({
  args: {
    token: v.string(),
    data: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { token, data, expiresAt }) => {
    await ctx.db.insert('sessionTransferTokens', { token, data, expiresAt })
  },
})

export const consumeToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const entry = await ctx.db
      .query('sessionTransferTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .unique()

    if (!entry) return null

    await ctx.db.delete(entry._id)

    if (entry.expiresAt < Date.now()) return null

    return entry.data
  },
})

export const cleanExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query('sessionTransferTokens')
      .collect()
    for (const entry of expired) {
      if (entry.expiresAt < now) {
        await ctx.db.delete(entry._id)
      }
    }
  },
})
