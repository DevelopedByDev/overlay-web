import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAccessToken, validateServerSecret } from './lib/auth'

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

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const all = await ctx.db
      .query('mcpServers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
    // Scrub authConfig from the response
    return all.map((s) => ({
      _id: s._id,
      userId: s.userId,
      name: s.name,
      description: s.description,
      transport: s.transport,
      url: s.url,
      enabled: s.enabled,
      authType: s.authType,
      hasAuth: !!s.authConfig,
      timeoutMs: s.timeoutMs,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  },
})

export const listEnabled = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    return await ctx.db
      .query('mcpServers')
      .withIndex('by_userId_enabled', (q) =>
        q.eq('userId', userId).eq('enabled', true)
      )
      .collect()
  },
})

export const get = query({
  args: {
    mcpServerId: v.id('mcpServers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { mcpServerId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const server = await ctx.db.get(mcpServerId)
    if (!server || server.userId !== userId) return null
    return server
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    transport: v.union(v.literal('sse'), v.literal('streamable-http')),
    url: v.string(),
    enabled: v.optional(v.boolean()),
    authType: v.optional(v.union(v.literal('none'), v.literal('bearer'), v.literal('header'))),
    authConfig: v.optional(
      v.object({
        bearerToken: v.optional(v.string()),
        headerName: v.optional(v.string()),
        headerValue: v.optional(v.string()),
      })
    ),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const now = Date.now()
    return await ctx.db.insert('mcpServers', {
      userId: args.userId,
      name: args.name,
      description: args.description,
      transport: args.transport,
      url: args.url,
      enabled: args.enabled ?? true,
      authType: args.authType ?? 'none',
      authConfig: args.authConfig,
      timeoutMs: args.timeoutMs,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    mcpServerId: v.id('mcpServers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    transport: v.optional(v.union(v.literal('sse'), v.literal('streamable-http'))),
    url: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    authType: v.optional(v.union(v.literal('none'), v.literal('bearer'), v.literal('header'))),
    authConfig: v.optional(
      v.object({
        bearerToken: v.optional(v.string()),
        headerName: v.optional(v.string()),
        headerValue: v.optional(v.string()),
      })
    ),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, { mcpServerId, userId, accessToken, serverSecret, ...updates }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const server = await ctx.db.get(mcpServerId)
    if (!server || server.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.transport !== undefined) patch.transport = updates.transport
    if (updates.url !== undefined) patch.url = updates.url
    if (updates.enabled !== undefined) patch.enabled = updates.enabled
    if (updates.authType !== undefined) patch.authType = updates.authType
    if (updates.authConfig !== undefined) patch.authConfig = updates.authConfig
    if (updates.timeoutMs !== undefined) patch.timeoutMs = updates.timeoutMs
    await ctx.db.patch(mcpServerId, patch)
  },
})

export const remove = mutation({
  args: {
    mcpServerId: v.id('mcpServers'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { mcpServerId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const server = await ctx.db.get(mcpServerId)
    if (!server || server.userId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.delete(mcpServerId)
  },
})
