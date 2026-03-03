import Stripe from 'stripe'

// Use dev credentials in development, production in production
const IS_DEV = process.env.NODE_ENV === 'development'

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      // In dev mode, use DEV_ keys; in production, use production keys
      const stripeSecretKey = IS_DEV 
        ? (process.env.DEV_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
        : process.env.STRIPE_SECRET_KEY
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY is not set')
      }
      console.log(`[Stripe] Using ${IS_DEV ? 'DEV/sandbox' : 'PROD/live'} environment`)
      _stripe = new Stripe(stripeSecretKey)
    }
    return _stripe[prop as keyof Stripe]
  }
})


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
