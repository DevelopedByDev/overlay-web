import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server'
import { requireServerSecret } from '../lib/auth'

const SNAPSHOT_KEY = 'vercel-ai-gateway'
const snapshotValidator = v.union(
  v.null(),
  v.object({
    source: v.string(),
    modelsJson: v.string(),
    fetchedAt: v.number(),
  }),
)

async function readSnapshot(ctx: QueryCtx | MutationCtx) {
  const row = await ctx.db
    .query('gatewayCatalogSnapshots')
    .withIndex('by_key', (q) => q.eq('key', SNAPSHOT_KEY))
    .first()
  return row
    ? {
        source: row.source,
        modelsJson: row.modelsJson,
        fetchedAt: row.fetchedAt,
      }
    : null
}

async function writeSnapshot(
  ctx: MutationCtx,
  args: { source: string; modelsJson: string; fetchedAt: number },
) {
  const existing = await ctx.db
    .query('gatewayCatalogSnapshots')
    .withIndex('by_key', (q) => q.eq('key', SNAPSHOT_KEY))
    .first()
  const value = {
    key: SNAPSHOT_KEY,
    source: args.source,
    modelsJson: args.modelsJson,
    fetchedAt: args.fetchedAt,
    updatedAt: Date.now(),
  }
  if (existing) await ctx.db.patch(existing._id, value)
  else await ctx.db.insert('gatewayCatalogSnapshots', value)
  return null
}

export const getByServer = query({
  args: { serverSecret: v.string() },
  returns: snapshotValidator,
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    return await readSnapshot(ctx)
  },
})

export const upsertByServer = mutation({
  args: {
    serverSecret: v.string(),
    source: v.string(),
    modelsJson: v.string(),
    fetchedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    return await writeSnapshot(ctx, args)
  },
})

export const getSnapshotInternal = internalQuery({
  args: {},
  returns: snapshotValidator,
  handler: readSnapshot,
})

export const upsertSnapshotInternal = internalMutation({
  args: {
    source: v.string(),
    modelsJson: v.string(),
    fetchedAt: v.number(),
  },
  returns: v.null(),
  handler: writeSnapshot,
})
