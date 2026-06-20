import { v } from 'convex/values'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server'
import { requireAccessToken, requireServerSecret } from '../lib/auth'
import type { Doc } from '../_generated/dataModel'

// ─── Types ───

const connectionStatusValidator = v.union(
  v.literal('active'),
  v.literal('error'),
  v.literal('untested'),
)

const connectionRowValidator = v.object({
  _id: v.id('userProviderConnections'),
  providerId: v.string(),
  endpoint: v.string(),
  displayName: v.string(),
  enabledModelIds: v.array(v.string()),
  status: connectionStatusValidator,
  lastError: v.optional(v.string()),
  lastTestedAt: v.optional(v.number()),
  isDefault: v.boolean(),
  isDeletable: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

/**
 * Strips secret fields (vaultKeyName, vaultObjectId, discoveredModelsJson) from a
 * connection row before returning it to the client.
 */
function stripSecrets(row: Doc<'userProviderConnections'>) {
  return {
    _id: row._id,
    providerId: row.providerId,
    endpoint: row.endpoint,
    displayName: row.displayName,
    enabledModelIds: row.enabledModelIds,
    status: row.status,
    lastError: row.lastError,
    lastTestedAt: row.lastTestedAt,
    isDefault: row.isDefault,
    isDeletable: row.isDeletable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ─── Helpers ───

async function readConnectionById(
  ctx: QueryCtx | MutationCtx,
  connectionId: string,
) {
  return await ctx.db.get(connectionId as Doc<'userProviderConnections'>['_id'])
}

// ─── Public Query (accessToken auth) ───

export const list = query({
  args: { accessToken: v.string(), userId: v.string() },
  returns: v.array(connectionRowValidator),
  handler: async (ctx, args) => {
    await requireAccessToken(args.accessToken, args.userId)
    const rows = await ctx.db
      .query('userProviderConnections')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect()
    return rows.map(stripSecrets)
  },
})

// ─── Server-Facing Mutations (serverSecret auth) ───
//
// These are called by the Next.js BFF after it has written/updated/deleted the
// API key in WorkOS Vault. The BFF passes the serverSecret to authenticate.

export const createByServer = mutation({
  args: {
    serverSecret: v.string(),
    userId: v.string(),
    providerId: v.string(),
    endpoint: v.string(),
    displayName: v.string(),
    vaultKeyName: v.string(),
    vaultObjectId: v.optional(v.string()),
    enabledModelIds: v.array(v.string()),
    isDefault: v.boolean(),
    isDeletable: v.boolean(),
  },
  returns: v.id('userProviderConnections'),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const now = Date.now()
    return await ctx.db.insert('userProviderConnections', {
      userId: args.userId,
      providerId: args.providerId,
      endpoint: args.endpoint,
      displayName: args.displayName,
      vaultKeyName: args.vaultKeyName,
      vaultObjectId: args.vaultObjectId,
      enabledModelIds: args.enabledModelIds,
      status: 'untested',
      isDefault: args.isDefault,
      isDeletable: args.isDeletable,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateByServer = mutation({
  args: {
    serverSecret: v.string(),
    connectionId: v.id('userProviderConnections'),
    displayName: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    vaultObjectId: v.optional(v.string()),
    enabledModelIds: v.optional(v.array(v.string())),
    discoveredModelsJson: v.optional(v.string()),
    discoveredAt: v.optional(v.number()),
    status: v.optional(connectionStatusValidator),
    lastError: v.optional(v.string()),
    lastTestedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const row = await readConnectionById(ctx, args.connectionId)
    if (!row) throw new Error('Connection not found')

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.displayName !== undefined) updates.displayName = args.displayName
    if (args.endpoint !== undefined) updates.endpoint = args.endpoint
    if (args.vaultObjectId !== undefined) updates.vaultObjectId = args.vaultObjectId
    if (args.enabledModelIds !== undefined) updates.enabledModelIds = args.enabledModelIds
    if (args.discoveredModelsJson !== undefined) updates.discoveredModelsJson = args.discoveredModelsJson
    if (args.discoveredAt !== undefined) updates.discoveredAt = args.discoveredAt
    if (args.status !== undefined) updates.status = args.status
    if (args.lastError !== undefined) updates.lastError = args.lastError
    if (args.lastTestedAt !== undefined) updates.lastTestedAt = args.lastTestedAt

    await ctx.db.patch(row._id, updates)
    return null
  },
})

export const deleteByServer = mutation({
  args: {
    serverSecret: v.string(),
    connectionId: v.id('userProviderConnections'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const row = await readConnectionById(ctx, args.connectionId)
    if (!row) throw new Error('Connection not found')
    if (!row.isDeletable) {
      throw new Error('This connection cannot be deleted (it is the default provider)')
    }
    await ctx.db.delete(row._id)
    return null
  },
})

// ─── Server-Facing Queries (serverSecret auth) ───
//
// Used by the runtime model resolver to fetch a user's connections (including
// vaultKeyName) so it can read the API key from WorkOS Vault.

const connectionWithVaultValidator = v.object({
  _id: v.id('userProviderConnections'),
  userId: v.string(),
  providerId: v.string(),
  endpoint: v.string(),
  vaultKeyName: v.string(),
  vaultObjectId: v.optional(v.string()),
  enabledModelIds: v.array(v.string()),
  isDefault: v.boolean(),
  isDeletable: v.boolean(),
  status: connectionStatusValidator,
})

export const getByServer = query({
  args: {
    serverSecret: v.string(),
    connectionId: v.string(),
  },
  returns: v.union(v.null(), connectionWithVaultValidator),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const row = await readConnectionById(ctx, args.connectionId)
    if (!row) return null
    return {
      _id: row._id,
      userId: row.userId,
      providerId: row.providerId,
      endpoint: row.endpoint,
      vaultKeyName: row.vaultKeyName,
      vaultObjectId: row.vaultObjectId,
      enabledModelIds: row.enabledModelIds,
      isDefault: row.isDefault,
      isDeletable: row.isDeletable,
      status: row.status,
    }
  },
})

export const listByServer = query({
  args: {
    serverSecret: v.string(),
    userId: v.string(),
  },
  returns: v.array(connectionWithVaultValidator),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const rows = await ctx.db
      .query('userProviderConnections')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect()
    return rows.map((row) => ({
      _id: row._id,
      userId: row.userId,
      providerId: row.providerId,
      endpoint: row.endpoint,
      vaultKeyName: row.vaultKeyName,
      vaultObjectId: row.vaultObjectId,
      enabledModelIds: row.enabledModelIds,
      isDefault: row.isDefault,
      isDeletable: row.isDeletable,
      status: row.status,
    }))
  },
})

// ─── Internal Mutations (no auth, called from Convex actions/scheduler) ───

export const createInternal = internalMutation({
  args: {
    userId: v.string(),
    providerId: v.string(),
    endpoint: v.string(),
    displayName: v.string(),
    vaultKeyName: v.string(),
    vaultObjectId: v.optional(v.string()),
    enabledModelIds: v.array(v.string()),
    isDefault: v.boolean(),
    isDeletable: v.boolean(),
  },
  returns: v.id('userProviderConnections'),
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert('userProviderConnections', {
      userId: args.userId,
      providerId: args.providerId,
      endpoint: args.endpoint,
      displayName: args.displayName,
      vaultKeyName: args.vaultKeyName,
      vaultObjectId: args.vaultObjectId,
      enabledModelIds: args.enabledModelIds,
      status: 'untested',
      isDefault: args.isDefault,
      isDeletable: args.isDeletable,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateInternal = internalMutation({
  args: {
    connectionId: v.id('userProviderConnections'),
    displayName: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    vaultObjectId: v.optional(v.string()),
    enabledModelIds: v.optional(v.array(v.string())),
    discoveredModelsJson: v.optional(v.string()),
    discoveredAt: v.optional(v.number()),
    status: v.optional(connectionStatusValidator),
    lastError: v.optional(v.string()),
    lastTestedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await readConnectionById(ctx, args.connectionId)
    if (!row) throw new Error('Connection not found')

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.displayName !== undefined) updates.displayName = args.displayName
    if (args.endpoint !== undefined) updates.endpoint = args.endpoint
    if (args.vaultObjectId !== undefined) updates.vaultObjectId = args.vaultObjectId
    if (args.enabledModelIds !== undefined) updates.enabledModelIds = args.enabledModelIds
    if (args.discoveredModelsJson !== undefined) updates.discoveredModelsJson = args.discoveredModelsJson
    if (args.discoveredAt !== undefined) updates.discoveredAt = args.discoveredAt
    if (args.status !== undefined) updates.status = args.status
    if (args.lastError !== undefined) updates.lastError = args.lastError
    if (args.lastTestedAt !== undefined) updates.lastTestedAt = args.lastTestedAt

    await ctx.db.patch(row._id, updates)
    return null
  },
})

export const deleteInternal = internalMutation({
  args: {
    connectionId: v.id('userProviderConnections'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await readConnectionById(ctx, args.connectionId)
    if (!row) throw new Error('Connection not found')
    await ctx.db.delete(row._id)
    return null
  },
})
