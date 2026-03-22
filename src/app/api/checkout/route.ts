import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'

/** Vercel Preview uses NODE_ENV=production; align price IDs with env (Vercel + .env.local). */
function resolvePriceIds(): { pro: string | undefined; max: string | undefined } {
  if (process.env.VERCEL_ENV === 'production') {
    return {
      pro: process.env.STRIPE_PRO_PRICE_ID,
      max: process.env.STRIPE_MAX_PRICE_ID,
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return {
      pro: process.env.DEV_STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID,
      max: process.env.DEV_STRIPE_MAX_PRICE_ID || process.env.STRIPE_MAX_PRICE_ID,
    }
  }
  return {
    pro: process.env.DEV_STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID,
    max: process.env.DEV_STRIPE_MAX_PRICE_ID || process.env.STRIPE_MAX_PRICE_ID,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to subscribe.' },
        { status: 401 }
      )
    }

    const { user } = session
    const body = await request.json()
    const { tier } = body

    if (!tier || !['pro', 'max'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const priceIds = resolvePriceIds()
    const priceId = tier === 'pro' ? priceIds.pro : priceIds.max

    if (!priceId) {
      console.error(`Missing price ID for tier: ${tier}`)
      const hint =
        process.env.VERCEL_ENV === 'production'
          ? `Set STRIPE_${tier.toUpperCase()}_PRICE_ID for Production in Vercel.`
          : `Set DEV_STRIPE_${tier.toUpperCase()}_PRICE_ID and/or STRIPE_${tier.toUpperCase()}_PRICE_ID for Preview / local.`
      return NextResponse.json(
        { error: `Price ID not configured for tier: ${tier}. ${hint}` },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()

    const checkoutSession = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/account?success=true&session_id={CHECKOUT_SESSION_ID}&open_app=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        tier,
        email: user.email
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          tier,
          email: user.email
        }
      },
      customer_email: user.email,
      allow_promotion_codes: true
    })

    console.log(
      `[Checkout] Created session for user ${user.id} (${user.email}) — tier: ${tier}`
    )
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}
