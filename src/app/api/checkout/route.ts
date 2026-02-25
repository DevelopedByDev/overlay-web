import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_LOOKUP_KEYS, getBaseUrl } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, userId } = body

    if (!tier || !['pro', 'max'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const lookupKey = tier === 'pro' ? PRICE_LOOKUP_KEYS.pro : PRICE_LOOKUP_KEYS.max

    // Get price by lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product']
    })

    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: `Price not found for lookup key: ${lookupKey}` },
        { status: 404 }
      )
    }

    const baseUrl = getBaseUrl()

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/account?success=true&session_id={CHECKOUT_SESSION_ID}`,
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
      // Allow promotion codes
      allow_promotion_codes: true
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
