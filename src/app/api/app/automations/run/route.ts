import { NextRequest, NextResponse } from 'next/server'
import { runActTurnForScheduledAutomation } from '@/lib/agent/run-act-turn'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { convex } from '@/lib/convex'
import { getServiceAuthHeaderName, verifyServiceAuthToken } from '@/lib/service-auth'
import { consumeServiceAuthReplayNonce } from '@/lib/service-auth-replay'

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

    const body = await request.json() as {
      runId?: string
    }
    if (!body.runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })
    const payload = await convex.query<{
      run: { status: string; scheduledFor: number; turnId?: string; conversationId?: Id<'conversations'> }
      automation: {
        _id: string
        userId: string
        name?: string
        title?: string
        description?: string
        instructions?: string
        instructionsMarkdown?: string
        projectId?: string
        modelId?: string
        sourceConversationId?: Id<'conversations'>
        conversationId?: Id<'conversations'>
      }
    } | null>('automations:getRunForExecutionByServer', {
      runId: body.runId as Id<'automationRuns'>,
      serverSecret: getInternalApiSecret(),
    })
    if (!payload || payload.run.status !== 'running') {
      return NextResponse.json({ error: 'Automation run is not executable' }, { status: 409 })
    }
    const { run, automation } = payload
    if (automation.userId !== serviceAuth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const turnId = run.turnId || `automation-${body.runId}-${Date.now()}`
    const conversationId = run.conversationId || automation.sourceConversationId || automation.conversationId

    const result = await runActTurnForScheduledAutomation({
      automationId: automation._id,
      runId: body.runId,
      userId: automation.userId,
      name: automation.name || automation.title || 'Untitled automation',
      description: automation.description || '',
      instructions: automation.instructions || automation.instructionsMarkdown || '',
      projectId: automation.projectId,
      modelId: automation.modelId,
      conversationId,
      turnId,
      scheduledFor: run.scheduledFor,
    })

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
    })
  } catch (error) {
    console.error('[automations/run]', error)
    return NextResponse.json(
      {
        error: 'Failed to run automation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
