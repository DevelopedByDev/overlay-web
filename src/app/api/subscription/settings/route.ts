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

  const response = await billingCustomerService.getBillingSettings({ userId: auth.userId })
  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  const disabledCapabilityResponse = await requireOverlayCapability('billing')
  if (disabledCapabilityResponse) return disabledCapabilityResponse

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const auth = await resolveAuthenticatedAppUser(request, body)
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const result = await billingCustomerService.updateBillingSettings({
      userId: auth.userId,
      body,
    })
    return NextResponse.json(result)
  } catch (error) {
    return billingErrorResponse(error, 'Failed to update billing settings')
  }
}
