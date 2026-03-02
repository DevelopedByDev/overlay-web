import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const stripeSecretKey = process.env.DEV_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY is not set (checked DEV_STRIPE_SECRET_KEY and STRIPE_SECRET_KEY)')
      }
      _stripe = new Stripe(stripeSecretKey)
    }
    return _stripe[prop as keyof Stripe]
  }
})

// Price lookup keys for Stripe products
export const PRICE_LOOKUP_KEYS = {
  proRefill: 'pro_refill',
  maxRefill: 'max_refill',
} as const

// Get the base URL for redirects
export function getBaseUrl(): string {
  if (process.env.DEV_NEXT_PUBLIC_APP_URL) {
    return process.env.DEV_NEXT_PUBLIC_APP_URL
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
