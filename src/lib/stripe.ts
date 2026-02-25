import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Price lookup keys for Stripe products
export const PRICE_LOOKUP_KEYS = {
  pro: 'pro_monthly',
  max: 'max_monthly',
  proRefill: 'pro_refill',
  maxRefill: 'max_refill'
} as const

// Get the base URL for redirects
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
