import Stripe from 'stripe'

/**
 * Vercel always runs Next with NODE_ENV=production, including Preview deployments.
 * Only treat Vercel Production as "must use live key only"; elsewhere accept
 * STRIPE_SECRET_KEY or DEV_STRIPE_SECRET_KEY so local dev and Preview work.
 */
function resolveStripeSecretKey(): string {
  const vercelEnv = process.env.VERCEL_ENV

  if (vercelEnv === 'production') {
    const key = process.env.STRIPE_SECRET_KEY
    if (key) return key
    throw new Error(
      'STRIPE_SECRET_KEY is not set. In Vercel: Project → Settings → Environment Variables, add STRIPE_SECRET_KEY for the Production environment.'
    )
  }

  const key =
    process.env.STRIPE_SECRET_KEY || process.env.DEV_STRIPE_SECRET_KEY
  if (key) return key

  throw new Error(
    'No Stripe secret key configured. Set STRIPE_SECRET_KEY or DEV_STRIPE_SECRET_KEY in .env.local (local), ' +
      'or in Vercel for Preview / Development — Preview does not inherit Production env vars unless you copy them.'
  )
}

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const stripeSecretKey = resolveStripeSecretKey()
      const mode =
        stripeSecretKey.startsWith('sk_live') ? 'live' : 'test/sandbox'
      console.log(`[Stripe] Initialized (${mode} key)`)
      _stripe = new Stripe(stripeSecretKey)
    }
    return _stripe[prop as keyof Stripe]
  },
})


export { getBaseUrl } from './url'
