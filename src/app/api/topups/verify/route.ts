import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { stripe } from '@/lib/stripe'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const TopupsVerifyRequestSchema = z.object({ sessionId: z.string().optional() }).openapi('TopupsVerifyRequest')
const TopupsVerifyResponseSchema = z.unknown().openapi('TopupsVerifyResponse')
void TopupsVerifyRequestSchema
void TopupsVerifyResponseSchema

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

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'billing:topup-verify:ip', key: getClientIp(request), limit: 20, windowMs: 10 * 60_000 },
      { bucket: 'billing:topup-verify:user', key: session.user.id, limit: 10, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const sessionId = String(body.sessionId ?? '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    if (
      sessionId !== '{CHECKOUT_SESSION_ID}' &&
      !sessionId.includes('CHECKOUT_SESSION_ID') &&
      !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)
    ) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
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
    if (checkoutSession.status !== 'complete' || checkoutSession.currency !== 'usd' || !checkoutSession.amount_total) {
      return NextResponse.json({ error: 'Invalid completed top-up session' }, { status: 400 })
    }

    const amountCents = checkoutSession.amount_total
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
