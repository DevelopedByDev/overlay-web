import { NextRequest, NextResponse } from 'next/server'
import { stripe, getBaseUrl } from '@/lib/stripe'
import { getSession } from '@/lib/workos-auth'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import {
  clampPaidPlanAmountCents,
  clampTopUpAmountCents,
  formatDollarAmount,
} from '@/lib/billing-pricing'
import { getPlanQuantityForCheckout, isRecognizedTopUpAmount, resolvePaidUnitPriceId } from '@/lib/stripe-billing'
import { isBillingDisabled } from '@/lib/billing-runtime'

import { z } from '@/lib/api-schemas'

const CheckoutRequestSchema = z.object({ planAmountCents: z.number().optional(), topUpAmountCents: z.number().optional(), autoTopUpEnabled: z.boolean().optional() }).passthrough().openapi('CheckoutRequest')
const CheckoutResponseSchema = z.unknown().openapi('CheckoutResponse')
void CheckoutRequestSchema
void CheckoutResponseSchema

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to subscribe.' },
        { status: 401 }
      )
    }

    if (isBillingDisabled()) {
      return NextResponse.json(
        { error: 'Billing is disabled for this deployment.' },
        { status: 403 },
      )
    }

    const { user } = session
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'billing:checkout:ip', key: getClientIp(request), limit: 10, windowMs: 10 * 60_000 },
      { bucket: 'billing:checkout:user', key: user.id, limit: 5, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const planAmountCents = clampPaidPlanAmountCents(Number(body.planAmountCents))
    const requestedTopUpAmountCents = Number(body.topUpAmountCents)
    const autoTopUpEnabled = Boolean(body.autoTopUpEnabled)
    const quantity = getPlanQuantityForCheckout(planAmountCents)
    const priceId = resolvePaidUnitPriceId()

    if (!isRecognizedTopUpAmount(requestedTopUpAmountCents)) {
      return NextResponse.json(
        { error: 'Unsupported top-up amount.' },
        { status: 400 }
      )
    }
    const topUpAmountCents = clampTopUpAmountCents(requestedTopUpAmountCents)

    if (!priceId) {
      console.error('Missing paid unit Stripe price ID')
      const hint =
        process.env.VERCEL_ENV === 'production'
          ? 'Set STRIPE_PAID_UNIT_PRICE_ID for Production in Vercel.'
          : 'Set DEV_STRIPE_PAID_UNIT_PRICE_ID and/or STRIPE_PAID_UNIT_PRICE_ID for Preview / local.'
      return NextResponse.json(
        { error: `Price ID not configured for the paid plan. ${hint}` },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()

    const offSessionConsentAt = autoTopUpEnabled ? Date.now() : undefined

    const checkoutSession = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity }],
      mode: 'subscription',
      success_url: `${baseUrl}/account?success=true&session_id={CHECKOUT_SESSION_ID}&open_app=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        kind: 'paid_plan',
        planKind: 'paid',
        planVersion: 'variable_v2',
        planAmountCents: String(planAmountCents),
        stripeQuantity: String(quantity),
        topUpAmountCents: String(topUpAmountCents),
        autoTopUpEnabled: String(autoTopUpEnabled),
        ...(offSessionConsentAt ? { offSessionConsentAt: String(offSessionConsentAt) } : {}),
        email: user.email
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          kind: 'paid_plan',
          planKind: 'paid',
          planVersion: 'variable_v2',
          planAmountCents: String(planAmountCents),
          stripeQuantity: String(quantity),
          topUpAmountCents: String(topUpAmountCents),
          autoTopUpEnabled: String(autoTopUpEnabled),
          ...(offSessionConsentAt ? { offSessionConsentAt: String(offSessionConsentAt) } : {}),
          email: user.email
        }
      },
      customer_email: user.email,
      allow_promotion_codes: true
    })

    console.log(
      `[Checkout] Created paid plan session for user ${user.id} (${user.email}) — plan=${formatDollarAmount(planAmountCents)} quantity=${quantity} topUp=${formatDollarAmount(topUpAmountCents)} autoTopUp=${autoTopUpEnabled}`
    )
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}
