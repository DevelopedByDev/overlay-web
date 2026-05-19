import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth/workos-auth'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { stripe, getBaseUrl } from '@/server/billing/stripe'
import { getTopUpPriceId, getTopUpQuantityForCheckout, isRecognizedTopUpAmount } from '@/server/billing/stripe-billing'
import { clampTopUpAmountCents, formatDollarAmount } from '@/shared/billing/billing-pricing'
import { enforceRateLimits, getClientIp } from '@/server/security/rate-limit'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { sameOriginPathUrl } from '@/shared/security/safe-url'

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
    const body = await request.json()
    const session = await getSession()
    const auth = await resolveAuthenticatedAppUser(request, body)
    const userId = auth?.userId
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userEmail = session?.user?.id === userId ? session.user.email : undefined

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'billing:topup:ip', key: getClientIp(request), limit: 10, windowMs: 10 * 60_000 },
      { bucket: 'billing:topup:user', key: userId, limit: 5, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const entitlements = await convex.query<{ planKind?: 'free' | 'paid' }>('platform/usage:getEntitlementsByServer', {
      serverSecret: getInternalApiSecret(),
      userId,
    })
    if (entitlements?.planKind !== 'paid') {
      return NextResponse.json({ error: 'Top-ups require an active paid plan.' }, { status: 403 })
    }

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
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        kind: 'budget_topup',
        userId,
        amountCents: String(amountCents),
        stripeQuantity: String(quantity),
        autoTopUpEnabled: String(autoTopUpEnabled),
      },
      payment_intent_data: {
        metadata: {
          kind: 'budget_topup',
          userId,
          amountCents: String(amountCents),
          stripeQuantity: String(quantity),
          autoTopUpEnabled: String(autoTopUpEnabled),
        },
      },
      allow_promotion_codes: false,
    })

    console.log(`[TopUp Checkout] Created manual top-up checkout for ${userId}: ${formatDollarAmount(amountCents)}`)
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('[TopUp Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create top-up checkout' }, { status: 500 })
  }
}
