import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { runAppAutomationNow } from '@/lib/app-api/automation-service'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { automationId?: string; accessToken?: string; userId?: string }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { automationId } = body
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    return NextResponse.json(await runAppAutomationNow({
      request,
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      automationId,
    }))
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 409 &&
      'automationRunId' in error
    ) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to run automation', automationRunId: error.automationRunId },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'Automation not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[automation run-now] POST error:', error)
    return NextResponse.json({ error: 'Failed to run automation' }, { status: 500 })
  }
}
