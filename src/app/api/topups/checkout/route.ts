import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getTopUpPriceId, getTopUpQuantityForCheckout, isRecognizedTopUpAmount } from '@/lib/stripe-billing'
import { clampTopUpAmountCents, formatDollarAmount } from '@/lib/billing-pricing'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { sameOriginPathUrl } from '@/lib/safe-url'

function resolveReturnUrl(baseUrl: string, returnPath: unknown, state: 'success' | 'canceled') {
  const url = new URL(sameOriginPathUrl(baseUrl, returnPath, '/account'))
  if (state === 'success') {
    const checkoutSessionPlaceholder = 'CHECKOUT_SESSION_ID_PLACEHOLDER'
    url.searchParams.set('topup_success', 'true')
    url.searchParams.set('topup_session_id', checkoutSessionPlaceholder)
    return url.toString().replace(checkoutSessionPlaceholder, '{CHECKOUT_SESSION_ID}')
  } else {
    url.searchParams.set('topup_canceled', 'true')
  }
  return url.toString()
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'billing:topup:ip', key: getClientIp(request), limit: 10, windowMs: 10 * 60_000 },
      { bucket: 'billing:topup:user', key: session.user.id, limit: 5, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const entitlements = await convex.query<{ planKind?: 'free' | 'paid' }>('usage:getEntitlementsByServer', {
      serverSecret: getInternalApiSecret(),
      userId: session.user.id,
    })
    if (entitlements?.planKind !== 'paid') {
      return NextResponse.json({ error: 'Top-ups require an active paid plan.' }, { status: 403 })
    }

    const body = await request.json()
    const requestedAmountCents = Number(body.amountCents)
    const autoTopUpEnabled = Boolean(body.autoTopUpEnabled)
    if (!isRecognizedTopUpAmount(requestedAmountCents)) {
      return NextResponse.json({ error: 'Unsupported top-up amount' }, { status: 400 })
    }
    const amountCents = clampTopUpAmountCents(requestedAmountCents)

    const priceId = getTopUpPriceId()
    if (!priceId) {
      return NextResponse.json({ error: 'Top-up price not configured' }, { status: 500 })
    }
    const quantity = getTopUpQuantityForCheckout(amountCents)

    const baseUrl = getBaseUrl()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      success_url: resolveReturnUrl(baseUrl, body.returnPath, 'success'),
      cancel_url: resolveReturnUrl(baseUrl, body.returnPath, 'canceled'),
      customer_email: session.user.email,
      metadata: {
        kind: 'budget_topup',
        userId: session.user.id,
        amountCents: String(amountCents),
        stripeQuantity: String(quantity),
        autoTopUpEnabled: String(autoTopUpEnabled),
      },
      payment_intent_data: {
        metadata: {
          kind: 'budget_topup',
          userId: session.user.id,
          amountCents: String(amountCents),
          stripeQuantity: String(quantity),
          autoTopUpEnabled: String(autoTopUpEnabled),
        },
      },
      allow_promotion_codes: false,
    })

    console.log(`[TopUp Checkout] Created manual top-up checkout for ${session.user.id}: ${formatDollarAmount(amountCents)}`)
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('[TopUp Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create top-up checkout' }, { status: 500 })
  }
}
