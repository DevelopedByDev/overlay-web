import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAccessToken } from './lib/auth'
import type { Id } from './_generated/dataModel'

export const list = query({
  args: { userId: v.string(), accessToken: v.string(), projectId: v.optional(v.string()) },
  handler: async (ctx, { userId, accessToken, projectId }) => {
    try {
      await requireAccessToken(accessToken, userId)
    } catch {
      return []
    }
    const all = await ctx.db
      .query('skills')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
    if (projectId !== undefined) {
      return all.filter((s) => s.projectId === projectId)
    }
    // Global skills = no projectId
    return all.filter((s) => !s.projectId)
  },
})

export const get = query({
  args: { skillId: v.id('skills'), userId: v.string(), accessToken: v.string() },
  handler: async (ctx, { skillId, userId, accessToken }) => {
    try {
      await requireAccessToken(accessToken, userId)
    } catch {
      return null
    }
    const skill = await ctx.db.get(skillId)
    return skill?.userId === userId ? skill : null
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    name: v.string(),
    description: v.string(),
    instructions: v.string(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAccessToken(args.accessToken, args.userId)
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId as Id<'projects'>)
      if (!project || project.userId !== args.userId) {
        throw new Error('Unauthorized')
      }
    }
    const now = Date.now()
    return await ctx.db.insert('skills', {
      userId: args.userId,
      name: args.name,
      description: args.description,
      instructions: args.instructions,
      projectId: args.projectId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    skillId: v.id('skills'),
    userId: v.string(),
    accessToken: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, { skillId, userId, accessToken, ...updates }) => {
    await requireAccessToken(accessToken, userId)
    const skill = await ctx.db.get(skillId)
    if (!skill || skill.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.instructions !== undefined) patch.instructions = updates.instructions
    await ctx.db.patch(skillId, patch)
  },
})

export const remove = mutation({
  args: { skillId: v.id('skills'), userId: v.string(), accessToken: v.string() },
  handler: async (ctx, { skillId, userId, accessToken }) => {
    await requireAccessToken(accessToken, userId)
    const skill = await ctx.db.get(skillId)
    if (!skill || skill.userId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.delete(skillId)
  },
})
