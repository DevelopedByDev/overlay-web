import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { retryAppAutomationRun } from '@/lib/app-api/automation-service'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      automationRunId?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { automationRunId } = body
    if (!automationRunId) {
      return NextResponse.json({ error: 'automationRunId required' }, { status: 400 })
    }

    const retryRun = await retryAppAutomationRun(
      auth.userId,
      getInternalApiSecret(),
      automationRunId,
    )
    if (!retryRun) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json(retryRun)
  } catch (error) {
    if (error instanceof Error && error.message === 'This run is already in progress or queued.') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[automation retry] POST error:', error)
    return NextResponse.json({ error: 'Failed to queue retry' }, { status: 500 })
  }
}
