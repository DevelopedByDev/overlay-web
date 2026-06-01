import { logger } from '@/server/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { automationErrorResponse, automationService } from '@/server/automations/http'
import { getServiceAuthHeaderName, verifyServiceAuthToken } from '@/server/auth/service-auth'
import { consumeServiceAuthReplayNonce } from '@/server/auth/service-auth-replay'

export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const serviceAuthHeader = request.headers.get(getServiceAuthHeaderName())
    const serviceAuth = serviceAuthHeader
      ? await verifyServiceAuthToken(
          serviceAuthHeader,
          {
            method: request.method,
            path: request.nextUrl.pathname,
            replayConsumer: consumeServiceAuthReplayNonce,
          },
        )
      : null
    if (!serviceAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { runId?: string }
    const result = await automationService.runAutomation({
      runId: body.runId,
      serviceUserId: serviceAuth.userId,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AutomationServiceError')) {
      logger.error('[automations/run]', error)
    }
    const response = automationErrorResponse(error, 'Failed to run automation')
    if (response.status === 500) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(
        {
          error: 'Failed to run automation',
          message,
        },
        { status: 500 },
      )
    }
    return response
  }
}
