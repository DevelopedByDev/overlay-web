import Stripe from 'stripe'

/**
 * Vercel always runs Next with NODE_ENV=production, including Preview deployments.
 * Only treat Vercel Production as "must use live key only"; elsewhere prefer
 * the dev key so local dev and Preview don't accidentally call live Stripe.
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
    process.env.DEV_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
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
        stripeSecretKey.startsWith('sk_live') || stripeSecretKey.startsWith('rk_live')
          ? 'live'
          : 'test/sandbox'
      if (stripeSecretKey.startsWith('rk_')) {
        throw new Error(
          `Stripe is configured with a restricted key (${mode}). Checkout requires a secret key with permission to create Checkout Sessions, Customers, Subscriptions, PaymentIntents, and read Prices. Use a full sk_${mode === 'live' ? 'live' : 'test'} key, or update the restricted key permissions in Stripe.`
        )
      }
      console.log(`[Stripe] Initialized (${mode} key)`)
      _stripe = new Stripe(stripeSecretKey)
    }
    return _stripe[prop as keyof Stripe]
  },
})


export { getBaseUrl } from './url'
