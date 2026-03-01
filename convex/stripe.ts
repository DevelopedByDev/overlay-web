import { action } from './_generated/server'
import { components } from './_generated/api'
import { StripeSubscriptions } from '@convex-dev/stripe'
import { v } from 'convex/values'

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
    // Get or create a Stripe customer
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: args.userId || 'anonymous',
      email: args.email,
      name: undefined
    })

    // Create checkout session
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

// Create a checkout session for a one-time refill payment
export const createRefillCheckout = action({
  args: {
    priceId: v.string(),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    tier: v.string(),
    credits: v.number(),
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
      mode: 'payment',
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
      paymentIntentMetadata: {
        userId: args.userId || '',
        type: 'refill',
        tier: args.tier,
        credits: String(args.credits)
      }
    })
  }
})

// Create a customer portal session for subscription management
export const createCustomerPortalSession = action({
  args: {
    stripeCustomerId: v.string(),
    returnUrl: v.string()
  },
  returns: v.object({
    url: v.string()
  }),
  handler: async (ctx, args) => {
    return await stripeClient.createCustomerPortalSession(ctx, {
      customerId: args.stripeCustomerId,
      returnUrl: args.returnUrl
    })
  }
})

// Cancel a subscription
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string()
  },
  returns: v.object({
    success: v.boolean()
  }),
  handler: async (ctx, args) => {
    await stripeClient.cancelSubscription(ctx, {
      stripeSubscriptionId: args.stripeSubscriptionId
    })
    return { success: true }
  }
})
