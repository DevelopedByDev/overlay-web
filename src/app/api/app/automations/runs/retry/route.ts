import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { AutomationRunSummary } from '@/lib/automations'
import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

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

    const userId = auth.userId
    const serverSecret = getInternalApiSecret()
    const run = await convex.query<AutomationRunSummary | null>(
      'automations:getRun',
      {
        automationRunId: automationRunId as Id<'automationRuns'>,
        userId,
        serverSecret,
      },
      { throwOnError: true },
    )
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    if (run.status === 'running' || run.status === 'queued') {
      return NextResponse.json({ error: 'This run is already in progress or queued.' }, { status: 409 })
    }

    const retryRunId = await convex.mutation<Id<'automationRuns'> | null>(
      'automations:queueRetryForRun',
      {
        automationRunId: automationRunId as Id<'automationRuns'>,
        userId,
        serverSecret,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
      },
      { throwOnError: true },
    )

    if (!retryRunId) {
      return NextResponse.json(
        { error: 'Retry is not available for this run.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true, automationRunId: retryRunId })
  } catch (error) {
    console.error('[automation retry] POST error:', error)
    return NextResponse.json({ error: 'Failed to queue retry' }, { status: 500 })
  }
}
