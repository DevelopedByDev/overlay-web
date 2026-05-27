// This webhook handler has been removed.
// All Stripe webhook processing is handled by the Convex HTTP handler in convex/http.ts
// which uses properly secured internalMutation calls.
//
// Register your Stripe webhook endpoint as:
//   https://<your-convex-deployment>.convex.site/stripe/webhook
//
// Do NOT register a separate Next.js webhook endpoint.

import { NextResponse } from 'next/server'
import { requireOverlayCapability } from '@/server/capabilities'

export async function POST() {
  const disabledCapabilityResponse = await requireOverlayCapability('billing')
  if (disabledCapabilityResponse) return disabledCapabilityResponse

  return NextResponse.json(
    { error: 'This webhook endpoint has been deprecated. Use the Convex HTTP handler instead.' },
    { status: 410 }
  )
}
