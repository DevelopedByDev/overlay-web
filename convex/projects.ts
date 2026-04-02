import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
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
    updatedSince: v.optional(v.number()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, updatedSince, includeDeleted }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('asc')
      .collect()
    return projects
      .filter((project) => (updatedSince !== undefined ? project.updatedAt > updatedSince : true))
      .filter((project) => (includeDeleted ? true : !project.deletedAt))
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
    return project?.userId === userId && !project.deletedAt ? project : null
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    clientId: v.optional(v.string()),
    name: v.string(),
    instructions: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, clientId, name, instructions, parentId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (clientId?.trim()) {
      const existing = await ctx.db
        .query('projects')
        .withIndex('by_userId_clientId', (q) => q.eq('userId', userId).eq('clientId', clientId.trim()))
        .first()
      if (existing) {
        return existing._id
      }
    }
    const now = Date.now()
    return await ctx.db.insert('projects', {
      userId,
      clientId: clientId?.trim() || undefined,
      name,
      instructions: instructions?.trim() || undefined,
      parentId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.optional(v.string()),
    instructions: v.optional(v.string()),
    parentId: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret, name, instructions, parentId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) {
      throw new Error('Unauthorized')
    }
    if (parentId !== undefined && parentId !== null) {
      const parent = await ctx.db.get(parentId as Id<'projects'>)
      if (!parent || parent.userId !== userId || parent.deletedAt) {
        throw new Error('Unauthorized')
      }
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (name !== undefined) patch.name = name
    if (instructions !== undefined) patch.instructions = instructions.trim() || undefined
    if (parentId !== undefined) patch.parentId = parentId || undefined
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
    const now = Date.now()

    const [conversations, notes] = await Promise.all([
      ctx.db.query('conversations').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
      ctx.db.query('notes').withIndex('by_projectId', (q) => q.eq('projectId', pid)).collect(),
    ])

    for (const conv of conversations) {
      if (conv.userId !== userId) continue
      await ctx.db.patch(conv._id, {
        deletedAt: now,
        updatedAt: now,
        lastModified: now,
      })
    }
    for (const note of notes) {
      if (note.userId !== userId) continue
      await ctx.db.patch(note._id, { deletedAt: now, updatedAt: now })
    }

    await ctx.db.patch(projectId, { deletedAt: now, updatedAt: now })
  },
})
