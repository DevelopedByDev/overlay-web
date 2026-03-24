import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireServerSecret } from './lib/auth'

const textEncoder = new TextEncoder()

async function hashTransferToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token.trim()))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const storeToken = mutation({
  args: {
    serverSecret: v.string(),
    token: v.string(),
    data: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { serverSecret, token, data, expiresAt }) => {
    requireServerSecret(serverSecret)
    const tokenHash = await hashTransferToken(token)
    await ctx.db.insert('sessionTransferTokens', { tokenHash, data, expiresAt })
  },
})

export const consumeToken = mutation({
  args: { token: v.string(), serverSecret: v.string() },
  handler: async (ctx, { token, serverSecret }) => {
    requireServerSecret(serverSecret)
    const tokenHash = await hashTransferToken(token)
    let entry = await ctx.db
      .query('sessionTransferTokens')
      .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
      .unique()

    if (!entry) {
      entry = await ctx.db
        .query('sessionTransferTokens')
        .withIndex('by_token', (q) => q.eq('token', token))
        .unique()
    }

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
