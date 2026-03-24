import { action } from './_generated/server'
import { internal, components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { v } from 'convex/values'
import { requireAccessToken } from './lib/auth'

const stripeClient = new StripeSubscriptions(components.stripe, {})

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
    await requireAccessToken(args.accessToken, args.userId)

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

/**
 * Creates a Stripe Checkout Session for a $10/mo computer subscription.
 * The computerId is embedded in subscriptionMetadata so the webhook
 * handler can route the payment confirmation to the right computer.
 */
export const createComputerCheckout = action({
  args: {
    computerId: v.string(),
    userId: v.string(),
    accessToken: v.string(),
    email: v.optional(v.string()),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireAccessToken(args.accessToken, args.userId)
    const priceId = process.env.STRIPE_COMPUTER_PRICE_ID
    if (!priceId) throw new Error('STRIPE_COMPUTER_PRICE_ID not configured')

    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: args.userId,
      email: args.email,
      name: undefined,
    })

    return await stripeClient.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode: 'subscription',
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
      subscriptionMetadata: {
        userId: args.userId,
        computerId: args.computerId,
      },
    })
  },
})
