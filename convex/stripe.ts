import { action } from './_generated/server'
import { internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { v } from 'convex/values'

const stripeClient = new StripeSubscriptions(components.stripe, {})

function validateAccessToken(accessToken: string): boolean {
  if (!accessToken || typeof accessToken !== 'string') return false
  const trimmed = accessToken.trim()
  if (trimmed.length < 20) return false
  const parts = trimmed.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      )
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
        return false
      }
    } catch {
      // Accept as opaque token
    }
  }
  return true
}

// Create a checkout session for a subscription
export const createSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    tier: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string()
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null())
  }),
  handler: async (ctx, args) => {
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: args.userId || 'anonymous',
      email: args.email,
      name: undefined
    })

    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customer.customerId,
      mode: 'subscription',
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
      subscriptionMetadata: {
        userId: args.userId || '',
        tier: args.tier
      }
    })
  }
})

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
    if (!validateAccessToken(args.accessToken)) {
      throw new Error('Invalid or expired access token')
    }

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
    if (!validateAccessToken(args.accessToken)) {
      throw new Error('Invalid or expired access token')
    }

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
