import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { requireOverlayCapability } from '@/server/capabilities'
import { billingCustomerService, billingErrorResponse } from '@/server/billing/http'

export async function GET(request: NextRequest) {
  const disabledCapabilityResponse = await requireOverlayCapability('billing')
  if (disabledCapabilityResponse) return disabledCapabilityResponse

  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const result = await billingCustomerService.getTopUpHistory({ userId: auth.userId })
    return NextResponse.json(result)
  } catch (error) {
    return billingErrorResponse(error, 'Failed to fetch top-up history')
  }
}
