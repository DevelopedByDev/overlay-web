import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getTopUpPreferenceSnapshot } from '@/lib/billing-runtime'
import type { NextRequest } from 'next/server'

import { z } from '@/lib/api-schemas'

const AppSubscriptionRequestSchema = z.object({ accessToken: z.string().optional(), userId: z.string().optional() }).openapi('AppSubscriptionRequest')
const AppSubscriptionResponseSchema = z.unknown().openapi('AppSubscriptionResponse')
void AppSubscriptionRequestSchema
void AppSubscriptionResponseSchema

type AppSubscriptionResponse = {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  planAmountCents?: number
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  autoTopUpAmountCents?: number
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const entitlements = await convex.query<AppSubscriptionResponse | null>(
      'usage:getEntitlementsByServer',
      {
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )
    if (!entitlements) {
      return NextResponse.json({ error: 'Failed to load subscription' }, { status: 502 })
    }
    return NextResponse.json({
      ...entitlements,
      ...getTopUpPreferenceSnapshot(entitlements),
      creditsUsed: entitlements.budgetUsedCents ?? entitlements.creditsUsed,
      creditsTotal:
        entitlements.budgetTotalCents !== undefined
          ? entitlements.budgetTotalCents / 100
          : entitlements.creditsTotal,
    })
  } catch (error) {
    console.error('[app/subscription]', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
