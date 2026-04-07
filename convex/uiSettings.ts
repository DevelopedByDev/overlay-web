import { v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireServerSecret } from './lib/auth'

const themeValidator = v.union(v.literal('light'), v.literal('dark'))
const uiSettingsValidator = v.object({
  theme: themeValidator,
  useSecondarySidebar: v.boolean(),
})

function defaultUiSettings() {
  return {
    theme: 'light' as const,
    useSecondarySidebar: false,
  }
}

async function getExistingSettings(
  ctx: QueryCtx | MutationCtx,
  userId: string,
) {
  return await ctx.db
    .query('userUiSettings')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export const getByServer = query({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
  },
  returns: uiSettingsValidator,
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const existing = await getExistingSettings(ctx, args.userId)
    if (!existing) return defaultUiSettings()
    return {
      theme: existing.theme,
      useSecondarySidebar: existing.useSecondarySidebar,
    }
  },
})

export const upsertByServer = mutation({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
    theme: v.optional(themeValidator),
    useSecondarySidebar: v.optional(v.boolean()),
  },
  returns: uiSettingsValidator,
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret)
    const now = Date.now()
    const existing = await getExistingSettings(ctx, args.userId)
    const next = {
      theme: args.theme ?? existing?.theme ?? 'light',
      useSecondarySidebar: args.useSecondarySidebar ?? existing?.useSecondarySidebar ?? false,
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...next,
        updatedAt: now,
      })
    } else {
      await ctx.db.insert('userUiSettings', {
        userId: args.userId,
        ...next,
        createdAt: now,
        updatedAt: now,
      })
    }

    return next
  },
})
