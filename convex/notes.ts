import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import type { Id } from './_generated/dataModel'

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

// Returns only notes NOT scoped to a project (for the main Notes tab).
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
      .query('notes')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(300)
    return all.filter((n) => !n.projectId).slice(0, 200)
  },
})

// Returns notes belonging to a specific project.
export const listByProject = query({
  args: {
    projectId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const notes = await ctx.db
      .query('notes')
      .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
      .order('desc')
      .collect()
    return notes.filter((note) => note.userId === userId)
  },
})

export const get = query({
  args: {
    noteId: v.id('notes'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const note = await ctx.db.get(noteId)
    return note?.userId === userId ? note : null
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId as Id<'projects'>)
      if (!project || project.userId !== args.userId) {
        throw new Error('Unauthorized')
      }
    }
    return await ctx.db.insert('notes', {
      userId: args.userId,
      title: args.title,
      content: args.content,
      tags: args.tags,
      projectId: args.projectId,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    noteId: v.id('notes'),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, noteId, ...updates }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(noteId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.content !== undefined) patch.content = updates.content
    if (updates.tags !== undefined) patch.tags = updates.tags
    await ctx.db.patch(noteId, patch)
  },
})

export const remove = mutation({
  args: {
    noteId: v.id('notes'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { noteId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(noteId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.delete(noteId)
  },
})
