import { action, internalAction } from './_generated/server'
import { components, internal } from './_generated/api'
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

// Trigger auto-refill payment using customer's saved payment method
export const triggerAutoRefill = action({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    amount: v.number(), // Amount in dollars
    credits: v.number() // Credits to add (after margin)
  },
  returns: v.object({
    success: v.boolean(),
    paymentIntentId: v.optional(v.string()),
    error: v.optional(v.string())
  }),
  handler: async (_ctx, args) => {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-01-27.acacia'
    })

    try {
      // Get customer's default payment method
      const customer = await stripe.customers.retrieve(args.stripeCustomerId)
      
      if (customer.deleted) {
        return { success: false, error: 'Customer deleted' }
      }

      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method
      
      if (!defaultPaymentMethod) {
        console.log(`[AutoRefill] No default payment method for customer ${args.stripeCustomerId}`)
        return { success: false, error: 'No default payment method' }
      }

      // Create and confirm payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(args.amount * 100), // Convert to cents
        currency: 'usd',
        customer: args.stripeCustomerId,
        payment_method: typeof defaultPaymentMethod === 'string' 
          ? defaultPaymentMethod 
          : defaultPaymentMethod.id,
        off_session: true,
        confirm: true,
        metadata: {
          userId: args.userId,
          type: 'addon',
          amount: String(args.amount),
          credits: String(args.credits),
          autoRefill: 'true'
        },
        description: `Auto-refill: $${args.amount} add-on credits`
      })

      console.log(`[AutoRefill] Payment successful for user ${args.userId}: ${paymentIntent.id}`)
      
      return { 
        success: true, 
        paymentIntentId: paymentIntent.id 
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[AutoRefill] Payment failed for user ${args.userId}:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }
})

// Internal action to check and process auto-refill
export const processAutoRefill = internalAction({
  args: {
    userId: v.string()
  },
  returns: v.object({
    triggered: v.boolean(),
    success: v.optional(v.boolean()),
    credits: v.optional(v.number()),
    reason: v.optional(v.string()),
    error: v.optional(v.string())
  }),
  handler: async (ctx, { userId }): Promise<{
    triggered: boolean
    success?: boolean
    credits?: number
    reason?: string
    error?: string
  }> => {
    // Check if auto-refill should trigger
    const checkResult = await ctx.runMutation(internal.subscriptions.checkAutoRefill, { userId })

    if (!checkResult.triggered || !checkResult.shouldCharge) {
      console.log(`[AutoRefill] Not triggered for user ${userId}: ${checkResult.reason}`)
      return { triggered: false, reason: checkResult.reason }
    }

    // Trigger the payment
    const paymentResult = await ctx.runAction(internal.stripe.triggerAutoRefillInternal, {
      userId: checkResult.userId as string,
      stripeCustomerId: checkResult.stripeCustomerId as string,
      amount: checkResult.amount as number,
      credits: checkResult.credits as number
    })

    if (paymentResult.success && paymentResult.paymentIntentId) {
      // Add credits to user account
      await ctx.runMutation(internal.subscriptions.addRefillCreditsInternal, {
        userId,
        credits: checkResult.credits as number,
        stripePaymentIntentId: paymentResult.paymentIntentId
      })

      console.log(`[AutoRefill] Successfully added ${checkResult.credits} credits for user ${userId}`)
      return { triggered: true, success: true, credits: checkResult.credits as number }
    }

    return { triggered: true, success: false, error: paymentResult.error }
  }
})

// Internal version of triggerAutoRefill for use by processAutoRefill
export const triggerAutoRefillInternal = internalAction({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    amount: v.number(),
    credits: v.number()
  },
  handler: async (_ctx, args) => {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-01-27.acacia'
    })

    try {
      const customer = await stripe.customers.retrieve(args.stripeCustomerId)
      
      if (customer.deleted) {
        return { success: false, error: 'Customer deleted' }
      }

      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method
      
      if (!defaultPaymentMethod) {
        return { success: false, error: 'No default payment method' }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(args.amount * 100),
        currency: 'usd',
        customer: args.stripeCustomerId,
        payment_method: typeof defaultPaymentMethod === 'string' 
          ? defaultPaymentMethod 
          : defaultPaymentMethod.id,
        off_session: true,
        confirm: true,
        metadata: {
          userId: args.userId,
          type: 'addon',
          amount: String(args.amount),
          credits: String(args.credits),
          autoRefill: 'true'
        },
        description: `Auto-refill: $${args.amount} add-on credits`
      })

      return { success: true, paymentIntentId: paymentIntent.id }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }
})
