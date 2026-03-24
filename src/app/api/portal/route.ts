import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

interface Subscription {
  userId: string
  stripeCustomerId?: string
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await getSession()
    if (!authSession || !authSession.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = authSession.user.id
    const body = await request.json()
    const { sessionId } = body

    let customerId: string | undefined

    // If we have a checkout session ID, get customer from there
    if (sessionId) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
      customerId = checkoutSession.customer as string
    }

    // Otherwise, look up customer from our database
    if (!customerId) {
      const subscription = await convex.query<Subscription>('subscriptions:getByUserId', {
        accessToken: authSession.accessToken,
        userId,
      })
      customerId = subscription?.stripeCustomerId
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No customer found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl()

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
