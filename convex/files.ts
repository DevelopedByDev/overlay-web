import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
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

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, projectId }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const allFiles = await ctx.db
      .query('files')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('asc')
      .collect()

    const filtered =
      projectId !== undefined
        ? allFiles.filter((f) => f.projectId === projectId)
        : allFiles

    return Promise.all(
      filtered.map(async (file) => {
        const content = file.storageId
          ? (await ctx.storage.getUrl(file.storageId)) ?? ''
          : (file.content ?? '')
        return {
          _id: file._id,
          userId: file.userId,
          name: file.name,
          type: file.type,
          parentId: file.parentId ?? null,
          content,
          projectId: file.projectId,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        }
      })
    )
  },
})

export const get = query({
  args: { fileId: v.id('files'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { fileId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const file = await ctx.db.get(fileId)
    if (!file || file.userId !== userId) return null
    const content = file.storageId
      ? (await ctx.storage.getUrl(file.storageId)) ?? ''
      : (file.content ?? '')
    return {
      _id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      parentId: file.parentId ?? null,
      content,
      projectId: file.projectId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.string(),
    type: v.union(v.literal('file'), v.literal('folder')),
    parentId: v.optional(v.string()),
    content: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, name, type, parentId, content, projectId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (parentId) {
      const parent = await ctx.db.get(parentId as Id<'files'>)
      if (!parent || parent.userId !== userId) {
        throw new Error('Unauthorized')
      }
    }
    if (projectId) {
      const project = await ctx.db.get(projectId as Id<'projects'>)
      if (!project || project.userId !== userId) {
        throw new Error('Unauthorized')
      }
    }
    const now = Date.now()
    const id = await ctx.db.insert('files', {
      userId,
      name,
      type,
      parentId,
      content: content ?? '',
      projectId,
      createdAt: now,
      updatedAt: now,
    })
    if (type === 'file' && (content ?? '').trim()) {
      await ctx.scheduler.runAfter(0, internal.knowledge.reindexFileInternal, { fileId: id })
    }
    return id
  },
})

export const createWithStorage = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.string(),
    parentId: v.optional(v.string()),
    storageId: v.id('_storage'),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, name, parentId, storageId, projectId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (parentId) {
      const parent = await ctx.db.get(parentId as Id<'files'>)
      if (!parent || parent.userId !== userId) {
        throw new Error('Unauthorized')
      }
    }
    if (projectId) {
      const project = await ctx.db.get(projectId as Id<'projects'>)
      if (!project || project.userId !== userId) {
        throw new Error('Unauthorized')
      }
    }
    const now = Date.now()
    const id = await ctx.db.insert('files', {
      userId,
      name,
      type: 'file',
      parentId,
      storageId,
      projectId,
      createdAt: now,
      updatedAt: now,
    })
    return id
  },
})

export const update = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    fileId: v.id('files'),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, fileId, name, content }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(fileId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (name !== undefined) patch.name = name
    if (content !== undefined) patch.content = content
    await ctx.db.patch(fileId, patch)
    const after = await ctx.db.get(fileId)
    if (after?.type === 'file' && !after.storageId) {
      await ctx.scheduler.runAfter(0, internal.knowledge.reindexFileInternal, { fileId })
    }
  },
})

export const remove = mutation({
  args: { fileId: v.id('files'), userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { fileId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const root = await ctx.db.get(fileId)
    if (!root || root.userId !== userId) {
      throw new Error('Unauthorized')
    }
    async function deleteSubtree(id: Id<'files'>) {
      const children = await ctx.db
        .query('files')
        .withIndex('by_parentId', (q) => q.eq('parentId', id as string))
        .collect()
      for (const child of children) {
        if (child.userId !== userId) {
          continue
        }
        await deleteSubtree(child._id)
      }
      const file = (await ctx.db.get(id)) as { type?: string; storageId?: Id<'_storage'> } | null
      if (file?.type === 'file') {
        await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
          sourceKind: 'file',
          sourceId: id,
        })
      }
      if (file?.storageId) {
        await ctx.storage.delete(file.storageId)
      }
      await ctx.db.delete(id)
    }
    await deleteSubtree(fileId)
  },
})

export const generateUploadUrl = mutation({
  args: { userId: v.string(), accessToken: v.optional(v.string()), serverSecret: v.optional(v.string()) },
  handler: async (ctx, { userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    return await ctx.storage.generateUploadUrl()
  },
})
