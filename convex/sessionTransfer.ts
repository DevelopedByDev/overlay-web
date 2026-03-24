import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireServerSecret } from './lib/auth'

export const storeToken = mutation({
  args: {
    serverSecret: v.string(),
    token: v.string(),
    data: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { serverSecret, token, data, expiresAt }) => {
    requireServerSecret(serverSecret)
    await ctx.db.insert('sessionTransferTokens', { token, data, expiresAt })
  },
})

export const consumeToken = mutation({
  args: { token: v.string(), serverSecret: v.string() },
  handler: async (ctx, { token, serverSecret }) => {
    requireServerSecret(serverSecret)
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
  args: { serverSecret: v.string() },
  handler: async (ctx, { serverSecret }) => {
    requireServerSecret(serverSecret)
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
