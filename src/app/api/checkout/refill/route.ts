import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_LOOKUP_KEYS, getBaseUrl } from '@/lib/stripe'
import { convex } from '@/lib/convex'

interface Subscription {
  userId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  currentPeriodStart?: number
  currentPeriodEnd?: number
  autoRefillEnabled: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user's subscription to verify they have an active paid plan
    const subscription = await convex.query<Subscription>('subscriptions:getSubscription', { userId })

    if (!subscription || subscription.tier === 'free') {
      return NextResponse.json(
        { error: 'Active subscription required for refills' },
        { status: 400 }
      )
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription must be active for refills' },
        { status: 400 }
      )
    }

    // Get the appropriate refill price based on tier
    const lookupKey =
      subscription.tier === 'pro' ? PRICE_LOOKUP_KEYS.proRefill : PRICE_LOOKUP_KEYS.maxRefill

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product']
    })

    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: `Refill price not found for tier: ${subscription.tier}` },
        { status: 404 }
      )
    }

    const baseUrl = getBaseUrl()

    // Create one-time payment checkout session
    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripeCustomerId || undefined,
      billing_address_collection: 'auto',
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1
        }
      ],
      mode: 'payment', // One-time purchase for refills
      success_url: `${baseUrl}/account?refill=success`,
      cancel_url: `${baseUrl}/account`,
      metadata: {
        userId,
        type: 'refill',
        tier: subscription.tier,
        // Amount of credits to add ($5 for pro, $50 for max)
        creditAmount: subscription.tier === 'pro' ? '5' : '50'
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Refill checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create refill checkout session' },
      { status: 500 }
    )
  }
}
