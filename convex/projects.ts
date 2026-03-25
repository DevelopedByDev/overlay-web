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
  args: { userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    return await ctx.db
      .query('projects')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('asc')
      .collect()
  },
})

export const get = query({
  args: { projectId: v.id('projects'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const project = await ctx.db.get(projectId)
    return project?.userId === userId ? project : null
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.string(),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, name, parentId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const now = Date.now()
    return await ctx.db.insert('projects', { userId, name, parentId, createdAt: now, updatedAt: now })
  },
})

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret, name }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (name !== undefined) patch.name = name
    await ctx.db.patch(projectId, patch)
  },
})

// Removes a single project and all its conversations/notes (no child-project cascade — handle that in the API layer).
export const remove = mutation({
  args: { projectId: v.id('projects'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const pid = projectId as string

    const [conversations, notes] = await Promise.all([
      ctx.db.query('conversations').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
      ctx.db.query('notes').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
    ])

    for (const conv of conversations) {
      if (conv.userId !== userId) continue
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
    for (const note of notes) {
      if (note.userId !== userId) continue
      await ctx.db.delete(note._id)
    }

    await ctx.db.delete(projectId)
  },
})
