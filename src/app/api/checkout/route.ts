import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'

// Use dev price IDs in development, production in production
const IS_DEV = process.env.NODE_ENV === 'development'

const PRICE_IDS = IS_DEV ? {
  pro: process.env.DEV_STRIPE_PRO_PRICE_ID,
  max: process.env.DEV_STRIPE_MAX_PRICE_ID
} : {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  max: process.env.STRIPE_MAX_PRICE_ID
}

export async function POST(request: NextRequest) {
  try {
    // Validate user session - REQUIRED for checkout
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

    const priceId = tier === 'pro' ? PRICE_IDS.pro : PRICE_IDS.max

    if (!priceId) {
      console.error(`Missing price ID for tier: ${tier}`)
      return NextResponse.json(
        { error: `Price ID not configured for tier: ${tier}. Please set STRIPE_${tier.toUpperCase()}_PRICE_ID in environment variables.` },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()

    // Create checkout session with validated user info from session
    const checkoutSession = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
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

    console.log(`[Checkout] Created session for user ${user.id} (${user.email}) - tier: ${tier}`)
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
