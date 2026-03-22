import type Stripe from 'stripe'

export function getSubscriptionPeriodMs(subscription: Stripe.Subscription): {
  currentPeriodStart: number
  currentPeriodEnd: number
} {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const firstItem = subscription.items.data[0]

  const itemPeriodStart = firstItem?.current_period_start
  const itemPeriodEnd = firstItem?.current_period_end

  return {
    currentPeriodStart:
      typeof itemPeriodStart === 'number' && itemPeriodStart > 0
        ? itemPeriodStart * 1000
        : subscription.billing_cycle_anchor * 1000 || now,
    currentPeriodEnd:
      typeof itemPeriodEnd === 'number' && itemPeriodEnd > 0
        ? itemPeriodEnd * 1000
        : now + thirtyDays,
  }
}

export function mapPriceToTier(priceId?: string): 'free' | 'pro' | 'max' {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID || process.env.DEV_STRIPE_PRO_PRICE_ID
  const maxPriceId = process.env.STRIPE_MAX_PRICE_ID || process.env.DEV_STRIPE_MAX_PRICE_ID

  console.log(`[Stripe] mapPriceToTier: priceId=${priceId}, proPriceId=${proPriceId}, maxPriceId=${maxPriceId}`)

  if (priceId === proPriceId) return 'pro'
  if (priceId === maxPriceId) return 'max'

  console.warn(`[Stripe] Unknown price ID: ${priceId}, defaulting to free`)
  return 'free'
}

export function extractCustomerInfo(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): { email?: string; name?: string } {
  if (!customer || typeof customer === 'string') {
    return {}
  }

  if ('deleted' in customer && customer.deleted) {
    return {}
  }

  return {
    email: customer.email || undefined,
    name: customer.name || undefined,
  }
}

export function mapSubscriptionStatus(
  status: string
): 'active' | 'canceled' | 'past_due' | 'trialing' {
  switch (status) {
    case 'active':
      return 'active'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'past_due':
      return 'past_due'
    case 'trialing':
      return 'trialing'
    default:
      return 'active'
  }
}
