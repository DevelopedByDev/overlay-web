import { v } from 'convex/values'
import { query } from './_generated/server'
import { debugAccessTokenVerification, requireServerSecret } from './lib/auth'

export const inspectAccessToken = query({
  args: {
    serverSecret: v.string(),
    accessToken: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    requireServerSecret(args.serverSecret)
    return await debugAccessTokenVerification(args.accessToken, args.userId)
  },
})
