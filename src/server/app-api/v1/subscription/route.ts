import { logger } from '@/server/observability/logger'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { billingCustomerService, billingErrorResponse } from '@/server/billing/http'

export async function GET(request: NextRequest, context: AppApiRouteContext) {
  const { auth } = context

  try {
    const response = await billingCustomerService.getAppSubscription({ userId: auth.userId })
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'BillingServiceError') {
      return billingErrorResponse(error, 'Failed to fetch subscription')
    }
    logger.error('[app/subscription]', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
