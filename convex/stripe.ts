import { action } from './_generated/server'
import { internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { v } from 'convex/values'
import { requireAccessToken } from './lib/auth'

const stripeClient = new StripeSubscriptions(components.stripe, {})

// Allowed origins for return URLs in Stripe portal/checkout redirects.
// Prevents open-redirect attacks where a malicious client supplies a returnUrl
// pointing to an attacker-controlled domain.
const ALLOWED_RETURN_ORIGINS = [
  'https://getoverlay.io',
  'https://www.getoverlay.io',
  'https://app.getoverlay.io',
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

function validateReturnUrl(url: string): void {
  // Allow localhost in non-production environments for developer convenience.
  if (
    process.env.NODE_ENV !== 'production' &&
    (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))
  ) {
    return
  }
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    throw new Error(`Invalid return URL: ${url}`)
  }
  const allowed = ALLOWED_RETURN_ORIGINS.some((o) => {
    try { return new URL(o).origin === origin } catch { return false }
  })
  if (!allowed) {
    throw new Error(`Return URL origin not allowed: ${origin}`)
  }
}

// NOTE: `createSubscriptionCheckout` was removed. It accepted an unauthenticated
// `userId` from the client and planted it in Stripe subscription metadata,
// which the webhook then used to assign a subscription to arbitrary accounts.
// Subscription checkout is now created exclusively from server-side Next.js
// routes (see src/app/api/checkout/route.ts) that derive the user identity
// from the authenticated session, never from client input.

// Create a customer portal session for subscription management
export const createBillingPortalSession: ReturnType<typeof action> = action({
  args: {
    accessToken: v.string(),
    userId: v.string(),
    stripeCustomerId: v.string(),
    returnUrl: v.string()
  },
  returns: v.object({
    url: v.string()
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    await requireAccessToken(args.accessToken, args.userId)
    validateReturnUrl(args.returnUrl)

    const subscription = await ctx.runQuery(internal.subscriptions.getByUserIdInternal, {
      userId: args.userId
    })
    if (!subscription || subscription.stripeCustomerId !== args.stripeCustomerId) {
      throw new Error('Stripe customer does not belong to authenticated user')
    }

    return await stripeClient.createCustomerPortalSession(ctx, {
      customerId: args.stripeCustomerId,
      returnUrl: args.returnUrl
    })
  }
})

// Cancel a subscription
export const cancelSubscription = action({
  args: {
    accessToken: v.string(),
    userId: v.string(),
    stripeSubscriptionId: v.string()
  },
  returns: v.object({
    success: v.boolean()
  }),
  handler: async (ctx, args) => {
    await requireAccessToken(args.accessToken, args.userId)

    const subscription = await ctx.runQuery(internal.subscriptions.getByUserIdInternal, {
      userId: args.userId
    })
    if (!subscription || subscription.stripeSubscriptionId !== args.stripeSubscriptionId) {
      throw new Error('Subscription does not belong to authenticated user')
    }

    await stripeClient.cancelSubscription(ctx, {
      stripeSubscriptionId: args.stripeSubscriptionId
    })
    return { success: true }
  }
})
