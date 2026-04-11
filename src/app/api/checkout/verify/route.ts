import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { quantityToPlanAmountCents } from '@/lib/billing-pricing'

function getSubscriptionPeriodMs(subscription: import('stripe').Stripe.Subscription) {
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const firstItem = subscription.items.data[0]

  return {
    currentPeriodStart:
      typeof firstItem?.current_period_start === 'number' && firstItem.current_period_start > 0
        ? firstItem.current_period_start * 1000
        : subscription.billing_cycle_anchor * 1000 || now,
    currentPeriodEnd:
      typeof firstItem?.current_period_end === 'number' && firstItem.current_period_end > 0
        ? firstItem.current_period_end * 1000
        : now + thirtyDays,
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (checkoutSession.metadata?.userId !== authSession.user.id) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
    }

    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const subscription = checkoutSession.subscription as import('stripe').Stripe.Subscription
    const firstItem = subscription.items.data[0]
    const priceId = firstItem?.price?.id
    const metadataQuantity = Number.parseInt(checkoutSession.metadata?.stripeQuantity ?? '0', 10)
    const quantity = firstItem?.quantity ?? (Number.isFinite(metadataQuantity) && metadataQuantity > 0 ? metadataQuantity : 1)
    const planAmountCents = quantityToPlanAmountCents(quantity)
    const topUpAmountCents = Number.parseInt(checkoutSession.metadata?.topUpAmountCents ?? '0', 10) || undefined
    const autoTopUpEnabled = checkoutSession.metadata?.autoTopUpEnabled === 'true'
    const offSessionConsentAt = Number.parseInt(checkoutSession.metadata?.offSessionConsentAt ?? '0', 10) || undefined
    const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodMs(subscription)

    await convex.mutation('subscriptions:upsertSubscription', {
      serverSecret: process.env.INTERNAL_API_SECRET || '',
      userId: authSession.user.id,
      stripeCustomerId: checkoutSession.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeQuantity: quantity,
      tier: 'pro',
      planKind: 'paid',
      planVersion: 'variable_v2',
      planAmountCents,
      autoTopUpEnabled,
      autoTopUpAmountCents: topUpAmountCents,
      offSessionConsentAt,
      status: 'active',
      currentPeriodStart,
      currentPeriodEnd,
    })

    console.log('[Checkout Verify] Subscription verified and updated')

    return NextResponse.json({
      success: true,
      planKind: 'paid',
      planAmountCents,
      message: 'Subscription activated successfully',
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
