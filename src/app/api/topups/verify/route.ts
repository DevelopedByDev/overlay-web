import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { stripe } from '@/lib/stripe'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { quantityToTopUpAmountCents } from '@/lib/billing-pricing'

async function findLatestPaidTopUpSession(userId: string) {
  const page = await stripe.checkout.sessions.list({ limit: 50 })
  return (
    page.data
      .filter((session) =>
        session.metadata?.kind === 'budget_topup' &&
        session.metadata?.userId === userId &&
        session.payment_status === 'paid' &&
        session.status === 'complete',
      )
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null
  )
}

async function resolveCheckoutSession(sessionId: string, userId: string) {
  const normalizedSessionId = sessionId.trim()
  const looksLikePlaceholder =
    !normalizedSessionId ||
    normalizedSessionId === '{CHECKOUT_SESSION_ID}' ||
    normalizedSessionId.includes('CHECKOUT_SESSION_ID')

  if (!looksLikePlaceholder) {
    try {
      return await stripe.checkout.sessions.retrieve(normalizedSessionId)
    } catch (error) {
      const stripeError = error as { code?: string }
      if (stripeError?.code !== 'resource_missing') {
        throw error
      }
    }
  }

  const fallbackSession = await findLatestPaidTopUpSession(userId)
  if (!fallbackSession) {
    throw new Error('No completed top-up checkout session found for this user')
  }
  return fallbackSession
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const checkoutSession = await resolveCheckoutSession(sessionId, session.user.id)
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
    }
    if (checkoutSession.metadata?.kind !== 'budget_topup') {
      return NextResponse.json({ error: 'Invalid top-up session' }, { status: 400 })
    }
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const lineItemQuantity = checkoutSession.amount_total && checkoutSession.currency === 'usd'
      ? Math.round(checkoutSession.amount_total / 100)
      : 0
    const metadataQuantity = Number.parseInt(checkoutSession.metadata?.stripeQuantity ?? '0', 10) || 0
    const amountCents =
      Number.parseInt(checkoutSession.metadata?.amountCents ?? '0', 10) ||
      quantityToTopUpAmountCents(metadataQuantity || lineItemQuantity)
    const autoTopUpEnabled = checkoutSession.metadata?.autoTopUpEnabled === 'true'
    await convex.mutation('subscriptions:recordBudgetTopUpByServer', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      amountCents,
      source: 'manual',
      stripeCustomerId: typeof checkoutSession.customer === 'string' ? checkoutSession.customer : undefined,
      stripeCheckoutSessionId: checkoutSession.id,
      stripePaymentIntentId: typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : undefined,
      status: 'succeeded',
    })
    await convex.mutation('subscriptions:updateBillingPreferencesByServer', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
      autoTopUpEnabled,
      topUpAmountCents: amountCents,
      grantOffSessionConsent: autoTopUpEnabled,
    })

    return NextResponse.json({ success: true, amountCents })
  } catch (error) {
    console.error('[TopUp Verify] Error:', error)
    return NextResponse.json({ error: 'Failed to verify top-up' }, { status: 500 })
  }
}
