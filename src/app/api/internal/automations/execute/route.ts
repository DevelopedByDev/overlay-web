import { NextRequest, NextResponse } from 'next/server'
import { validateServerSecret } from '../../../../../../convex/lib/auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getInternalApiBaseUrl } from '@/lib/url'
import type { AutomationSummary, AutomationRunSummary } from '@/lib/automations'
import {
  buildAutomationRunPrompt,
  ensureAutomationConversation,
  executeAutomationTurn,
  loadAutomationSourceInstructions,
} from '@/lib/automation-runner'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  try {
    if (!validateServerSecret(request.headers.get('x-internal-api-secret')?.trim() || undefined)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { automationId, automationRunId, userId } = (await request.json()) as {
      automationId?: string
      automationRunId?: string
      userId?: string
    }
    if (!automationId || !automationRunId || !userId) {
      return NextResponse.json(
        { error: 'automationId, automationRunId, and userId are required' },
        { status: 400 },
      )
    }

    const serverSecret = getInternalApiSecret()
    const automation = await convex.query<AutomationSummary | null>(
      'automations:get',
      {
        automationId: automationId as Id<'automations'>,
        userId,
        serverSecret,
      },
      { throwOnError: true },
    )
    const run = await convex.query<AutomationRunSummary | null>(
      'automations:getRun',
      {
        automationRunId: automationRunId as Id<'automationRuns'>,
        userId,
        serverSecret,
      },
      { throwOnError: true },
    )

    if (!automation || !run) {
      return NextResponse.json({ error: 'Automation run not found' }, { status: 404 })
    }

    if (automation.status !== 'active') {
      const finishedAt = Date.now()
      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'skipped',
          finishedAt,
          durationMs: 0,
          conversationId: run.conversationId as Id<'conversations'> | undefined,
          errorCode: 'automation_inactive',
          errorMessage: 'Automation is no longer active.',
        },
        { throwOnError: true },
      )
      return NextResponse.json({ success: true, skipped: true })
    }

    if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const sourceInstructions = await loadAutomationSourceInstructions(automation, userId, serverSecret)
    const prompt = buildAutomationRunPrompt(automation, sourceInstructions)
    const conversationId = await ensureAutomationConversation({
      userId,
      serverSecret,
      automation,
    })

    await convex.mutation(
      'automations:updateRun',
      {
        automationRunId: automationRunId as Id<'automationRuns'>,
        userId,
        serverSecret,
        status: 'running',
        startedAt,
        conversationId,
      },
      { throwOnError: true },
    )

    try {
      const result = await executeAutomationTurn({
        automation,
        baseUrl: getInternalApiBaseUrl(request),
        internalApiSecret: serverSecret,
        conversationId,
        prompt,
        userId,
        serverSecret,
      })
      const finishedAt = Date.now()

      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'succeeded',
          finishedAt,
          durationMs: finishedAt - startedAt,
          conversationId,
        turnId: result.turnId,
          resultSummary: result.summary,
        },
        { throwOnError: true },
      )

      return NextResponse.json({
        success: true,
        automationRunId,
        conversationId,
        turnId: result.turnId,
        resultSummary: result.summary,
      })
    } catch (error) {
      const finishedAt = Date.now()
      const message = error instanceof Error ? error.message : 'Automation execution failed'
      const turnId =
        error && typeof error === 'object' && 'turnId' in error && typeof error.turnId === 'string'
          ? error.turnId
          : undefined

      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'failed',
          finishedAt,
          durationMs: finishedAt - startedAt,
          conversationId,
          turnId,
          errorCode: 'scheduled_run_failed',
          errorMessage: message,
        },
        { throwOnError: true },
      )

      await convex.mutation(
        'automations:queueRetryForRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          errorCode: 'scheduled_run_failed',
          errorMessage: message,
        },
        { throwOnError: true },
      )

      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('[automation internal execute] POST error:', error)
    return NextResponse.json({ error: 'Failed to execute automation' }, { status: 500 })
  }
}
