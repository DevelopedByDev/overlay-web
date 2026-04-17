import { v } from 'convex/values'
import { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import { applyStorageUsageDelta, ensureStorageAvailable } from './lib/storageQuota'
import { assertOwnedFileR2Key, isOwnedFileR2Key } from '../src/lib/storage-keys'

const utf8Encoder = new TextEncoder()

function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length
}

function buildProxyUrl(fileId: Id<'files'>): string {
  return `/api/app/files/${fileId}/content`
}

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

type FilesCtxLike = {
  db: {
    query: (table: 'files') => {
      withIndex: (index: string, cb: (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) => unknown) => {
        collect: () => Promise<Doc<'files'>[]>
      }
    }
    patch: (id: Id<'files'>, value: Partial<Doc<'files'>>) => Promise<void>
  }
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

    return filtered.map((file) => {
      const hasInlineText = Boolean(file.content?.trim())
      const blobBacked = Boolean(file.storageId ?? file.r2Key)
      const storageBackedForDownload = blobBacked && !hasInlineText
      return {
      _id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      parentId: file.parentId ?? null,
      sizeBytes: file.sizeBytes ?? (file.content ? utf8ByteLength(file.content) : 0),
      isStorageBacked: storageBackedForDownload,
      downloadUrl: storageBackedForDownload ? buildProxyUrl(file._id) : undefined,
      projectId: file.projectId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }
    })
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
    const hasInlineText = Boolean(file.content?.trim())
    const blobBacked = Boolean(file.storageId ?? file.r2Key)
    const useProxyForContent = blobBacked && !hasInlineText
    return {
      _id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      parentId: file.parentId ?? null,
      content: useProxyForContent ? buildProxyUrl(file._id) : (file.content ?? ''),
      storageId: file.storageId ?? null,
      r2Key: file.r2Key ?? null,
      sizeBytes: file.sizeBytes ?? (file.content ? utf8ByteLength(file.content) : 0),
      isStorageBacked: useProxyForContent,
      projectId: file.projectId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }
  },
})

export const getStorageUrlForProxy = query({
  args: {
    fileId: v.id('files'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { fileId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const file = await ctx.db.get(fileId)
    if (!file || file.userId !== userId) return null
    if (file.r2Key) {
      if (!isOwnedFileR2Key(userId, file.r2Key)) {
        return null
      }
      return {
        r2Key: file.r2Key,
        name: file.name,
        mimeType: undefined as string | undefined,
        sizeBytes: file.sizeBytes ?? 0,
      }
    }
    if (file.storageId) {
      const url = await ctx.storage.getUrl(file.storageId)
      if (!url) return null
      return {
        url,
        name: file.name,
        mimeType: undefined as string | undefined,
        sizeBytes: file.sizeBytes ?? 0,
      }
    }
    return null
  },
})

export const getR2KeysForSubtree = query({
  args: {
    fileId: v.id('files'),
    userId: v.string(),
    serverSecret: v.optional(v.string()),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, { fileId, userId, serverSecret, accessToken }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const root = await ctx.db.get(fileId)
    if (!root || root.userId !== userId) return []
    const results: Array<{ fileId: Id<'files'>; r2Key?: string; storageId?: string }> = []
    async function collectSubtree(id: Id<'files'>) {
      const children = await ctx.db
        .query('files')
        .withIndex('by_parentId', (q) => q.eq('parentId', id as string))
        .collect()
      for (const child of children) {
        if (child.userId !== userId) continue
        await collectSubtree(child._id)
      }
      const file = await ctx.db.get(id)
      if (file) {
        results.push({
          fileId: id,
          r2Key: file.r2Key,
          storageId: file.storageId as string | undefined,
        })
      }
    }
    await collectSubtree(fileId)
    return results
  },
})

// ─── Mutations ────────────────────────────────────────────────────────────────

async function findCanonicalDuplicate(
  ctx: FilesCtxLike,
  userId: string,
  contentHash: string | undefined,
  ignoreFileId?: Id<'files'>,
): Promise<Doc<'files'> | null> {
  if (!contentHash) return null
  const matches = await ctx.db
    .query('files')
    .withIndex('by_userId_contentHash', (q) => q.eq('userId', userId).eq('contentHash', contentHash))
    .collect()

  for (const match of matches) {
    if (ignoreFileId && match._id === ignoreFileId) continue
    if (match.duplicateOfFileId) continue
    return match
  }

  return null
}

async function maybePromoteDuplicate(
  ctx: FilesCtxLike,
  userId: string,
  canonicalFileId: Id<'files'>,
): Promise<Id<'files'> | null> {
  const duplicates = await ctx.db
    .query('files')
    .withIndex('by_duplicateOfFileId', (q) => q.eq('duplicateOfFileId', canonicalFileId))
    .collect()
  const promoted = duplicates.find((candidate) => candidate.userId === userId)
  if (!promoted) return null
  await ctx.db.patch(promoted._id, {
    duplicateOfFileId: undefined,
  })
  return promoted._id
}

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    name: v.string(),
    type: v.union(v.literal('file'), v.literal('folder')),
    parentId: v.optional(v.string()),
    content: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    projectId: v.optional(v.string()),
    /** Original bytes on R2 (e.g. PDF) while `content` holds extracted text for search. */
    r2Key: v.optional(v.string()),
    /** Byte size for quota when using R2 (e.g. original file size). */
    sizeBytesOverride: v.optional(v.number()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, name, type, parentId, content, contentHash, projectId, r2Key, sizeBytesOverride }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (r2Key) {
      assertOwnedFileR2Key(userId, r2Key)
    }
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
    const inlineContent = content ?? ''
    const textBytes = type === 'file' ? utf8ByteLength(inlineContent) : 0
    const sizeBytes =
      type === 'file'
        ? Math.max(textBytes, typeof sizeBytesOverride === 'number' && sizeBytesOverride > 0 ? sizeBytesOverride : 0)
        : 0
    if (type === 'file' && sizeBytes > 0) {
      await ensureStorageAvailable(ctx as never, userId, sizeBytes)
    }
    const canonicalDuplicate =
      type === 'file' && inlineContent.trim() && contentHash
        ? await findCanonicalDuplicate(ctx as never, userId, contentHash)
        : null
    const id = await ctx.db.insert('files', {
      userId,
      name,
      type,
      parentId,
      content: inlineContent,
      sizeBytes,
      contentHash,
      duplicateOfFileId: canonicalDuplicate?._id,
      projectId,
      r2Key,
      createdAt: now,
      updatedAt: now,
    })
    if (type === 'file' && sizeBytes > 0) {
      await applyStorageUsageDelta(ctx as never, userId, sizeBytes)
    }
    if (type === 'file' && inlineContent.trim() && !canonicalDuplicate) {
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
    storageId: v.optional(v.id('_storage')),
    r2Key: v.optional(v.string()),
    sizeBytes: v.number(),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, name, parentId, storageId, r2Key, sizeBytes, projectId }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    if (storageId) {
      throw new Error('Convex file storage is deprecated; upload to R2 and pass r2Key only')
    }
    if (!r2Key) {
      throw new Error('createWithStorage requires r2Key')
    }
    assertOwnedFileR2Key(userId, r2Key)
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
    await ensureStorageAvailable(ctx as never, userId, sizeBytes)
    const now = Date.now()
    const id = await ctx.db.insert('files', {
      userId,
      name,
      type: 'file',
      parentId,
      r2Key,
      sizeBytes,
      projectId,
      createdAt: now,
      updatedAt: now,
    })
    await applyStorageUsageDelta(ctx as never, userId, sizeBytes)
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
    contentHash: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, fileId, name, content, contentHash }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(fileId)
    if (!existing || existing.userId !== userId) {
      throw new Error('Unauthorized')
    }
    const blobOnly =
      (existing.storageId || existing.r2Key) && !(existing.content && existing.content.trim().length > 0)
    if (blobOnly && content !== undefined) {
      throw new Error('Storage-backed files cannot be edited inline.')
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (name !== undefined) patch.name = name
    let shouldReindex = false
    let shouldPurge = false
    let storageDelta = 0
    if (content !== undefined) {
      const nextSizeBytes = utf8ByteLength(content)
      const previousSizeBytes = existing.sizeBytes ?? utf8ByteLength(existing.content ?? '')
      storageDelta = nextSizeBytes - previousSizeBytes
      if (storageDelta > 0) {
        await ensureStorageAvailable(ctx as never, userId, storageDelta)
      }
      const canonicalDuplicate =
        content.trim() && contentHash
          ? await findCanonicalDuplicate(ctx as never, userId, contentHash, fileId)
          : null
      patch.content = content
      patch.sizeBytes = nextSizeBytes
      patch.contentHash = contentHash
      patch.duplicateOfFileId = canonicalDuplicate?._id
      shouldPurge = true
      shouldReindex = content.trim().length > 0 && !canonicalDuplicate
    }
    await ctx.db.patch(fileId, patch)
    if (storageDelta !== 0) {
      await applyStorageUsageDelta(ctx as never, userId, storageDelta)
    }
    const skipPurgeForBlobOnly =
      (existing.storageId || existing.r2Key) && !(existing.content && existing.content.trim().length > 0)
    if (existing.type === 'file' && shouldPurge && !skipPurgeForBlobOnly) {
      await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
        sourceKind: 'file',
        sourceId: fileId,
        userId,
      })
    }
    if (shouldReindex) {
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
      const fullFile = await ctx.db.get(id)
      let promotedDuplicateId: Id<'files'> | null = null
      if (fullFile?.type === 'file' && !fullFile.duplicateOfFileId) {
        promotedDuplicateId = await maybePromoteDuplicate(ctx as never, userId, id)
      }
      if (file?.type === 'file') {
        await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
          sourceKind: 'file',
          sourceId: id,
          userId,
        })
      }
      if (file?.storageId) {
        await ctx.storage.delete(file.storageId)
      }
      if (fullFile?.sizeBytes) {
        await applyStorageUsageDelta(ctx as never, userId, -fullFile.sizeBytes)
      }
      await ctx.db.delete(id)
      if (promotedDuplicateId) {
        await ctx.scheduler.runAfter(0, internal.knowledge.reindexFileInternal, { fileId: promotedDuplicateId })
      }
    }
    await deleteSubtree(fileId)
  },
})
