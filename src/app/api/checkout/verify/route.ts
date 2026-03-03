import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function POST(request: NextRequest) {
  try {
    // Validate user session
    const authSession = await getSession()
    
    if (!authSession || !authSession.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    })

    // Verify the session belongs to this user
    if (checkoutSession.metadata?.userId !== authSession.user.id) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
    }

    // Check if payment was successful
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const subscription = checkoutSession.subscription as import('stripe').Stripe.Subscription
    const tier = checkoutSession.metadata?.tier as 'pro' | 'max' || 'pro'

    // Update subscription in Convex using string path
    await convex.mutation('subscriptions:upsertSubscription', {
      userId: authSession.user.id,
      stripeCustomerId: checkoutSession.customer as string,
      stripeSubscriptionId: subscription.id,
      tier,
      status: 'active',
      currentPeriodStart: (subscription as unknown as { current_period_start: number }).current_period_start,
      currentPeriodEnd: (subscription as unknown as { current_period_end: number }).current_period_end
    })

    console.log(`[Checkout Verify] Subscription verified and updated for user ${authSession.user.id}: ${tier}`)

    return NextResponse.json({ 
      success: true, 
      tier,
      message: 'Subscription activated successfully'
    })
  } catch (error) {
    console.error('[Checkout Verify] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to verify checkout: ${errorMessage}` },
      { status: 500 }
    )
  }
}
