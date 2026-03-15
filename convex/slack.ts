import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const getInstallation = query({
  args: { teamId: v.string() },
  handler: async (ctx, { teamId }) => {
    return await ctx.db
      .query('slackInstallations')
      .withIndex('by_teamId', (q) => q.eq('teamId', teamId))
      .first()
  },
})

export const saveInstallation = mutation({
  args: {
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    botUserId: v.string(),
    installedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('slackInstallations')
      .withIndex('by_teamId', (q) => q.eq('teamId', args.teamId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, installedAt: Date.now() })
      return existing._id
    }
    return await ctx.db.insert('slackInstallations', { ...args, installedAt: Date.now() })
  },
})

export const getUserLink = query({
  args: { slackUserId: v.string(), teamId: v.string() },
  handler: async (ctx, { slackUserId, teamId }) => {
    return await ctx.db
      .query('slackUserLinks')
      .withIndex('by_slack', (q) => q.eq('slackUserId', slackUserId).eq('teamId', teamId))
      .first()
  },
})

export const linkUser = mutation({
  args: { slackUserId: v.string(), teamId: v.string(), overlayUserId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('slackUserLinks')
      .withIndex('by_slack', (q) => q.eq('slackUserId', args.slackUserId).eq('teamId', args.teamId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { overlayUserId: args.overlayUserId, linkedAt: Date.now() })
      return existing._id
    }
    return await ctx.db.insert('slackUserLinks', { ...args, linkedAt: Date.now() })
  },
})

export const getConversation = query({
  args: { slackChannelId: v.string(), slackThreadTs: v.optional(v.string()) },
  handler: async (ctx, { slackChannelId, slackThreadTs }) => {
    return await ctx.db
      .query('slackConversations')
      .withIndex('by_channel_thread', (q) => q.eq('slackChannelId', slackChannelId).eq('slackThreadTs', slackThreadTs))
      .first()
  },
})

export const upsertConversation = mutation({
  args: {
    slackChannelId: v.string(),
    slackThreadTs: v.optional(v.string()),
    overlayUserId: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal('user'), v.literal('assistant')),
      content: v.string(),
      ts: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('slackConversations')
      .withIndex('by_channel_thread', (q) =>
        q.eq('slackChannelId', args.slackChannelId).eq('slackThreadTs', args.slackThreadTs)
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { messages: args.messages, updatedAt: Date.now() })
      return existing._id
    }
    return await ctx.db.insert('slackConversations', { ...args, updatedAt: Date.now() })
  },
})
