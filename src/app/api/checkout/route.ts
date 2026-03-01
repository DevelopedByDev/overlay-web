import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'

// Price IDs - use DEV_ prefix for development, fallback to production
const PRICE_IDS = {
  pro: process.env.DEV_STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID,
  max: process.env.DEV_STRIPE_MAX_PRICE_ID || process.env.STRIPE_MAX_PRICE_ID,
  proRefill: process.env.DEV_STRIPE_PRO_REFILL_PRICE_ID || process.env.STRIPE_PRO_REFILL_PRICE_ID,
  maxRefill: process.env.DEV_STRIPE_MAX_REFILL_PRICE_ID || process.env.STRIPE_MAX_REFILL_PRICE_ID
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, userId } = body

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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
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
        userId: userId || '',
        tier
      },
      subscription_data: {
        metadata: {
          userId: userId || '',
          tier
        }
      },
      allow_promotion_codes: true
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}
