import Stripe from 'stripe'

// Use DEV_ prefix for development, fallback to production
const stripeSecretKey = process.env.DEV_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set (checked DEV_STRIPE_SECRET_KEY and STRIPE_SECRET_KEY)')
}

export const stripe = new Stripe(stripeSecretKey)

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
