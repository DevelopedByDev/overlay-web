import { NextRequest, NextResponse } from 'next/server'
import { validateServerSecret } from '../../../../../../convex/lib/auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getInternalApiBaseUrl } from '@/lib/url'
import { resolveAutomationExecutorMetadata } from '@/lib/automation-execution'
import type { AutomationSummary, AutomationRunSummary } from '@/lib/automations'
import { runAutomationIntegrationPreflight } from '@/lib/automation-preflight'
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

    const { automationId, automationRunId, userId, requestId: incomingRequestId } = (await request.json()) as {
      automationId?: string
      automationRunId?: string
      userId?: string
      requestId?: string
    }
    if (!automationId || !automationRunId || !userId) {
      return NextResponse.json(
        { error: 'automationId, automationRunId, and userId are required' },
        { status: 400 },
      )
    }

    const serverSecret = getInternalApiSecret()
    const requestId = incomingRequestId?.trim() || `automation-run-${automationRunId}-${startedAt}`
    const executor = resolveAutomationExecutorMetadata(request.headers)
    const appendEvent = async (
      stage: 'dispatching' | 'running' | 'persisting' | 'succeeded' | 'failed' | 'needs_setup',
      level: 'info' | 'warning' | 'error',
      message: string,
      metadata?: Record<string, unknown>,
    ) => {
      await convex.mutation(
        'automations:appendRunEvent',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          stage,
          level,
          message,
          metadata,
        },
        { throwOnError: true },
      )
    }
    const heartbeat = async (stage?: 'running' | 'persisting') => {
      await convex.mutation(
        'automations:updateRunHeartbeat',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          ...(stage ? { stage } : {}),
          lastHeartbeatAt: Date.now(),
        },
        { throwOnError: true },
      )
    }
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
          stage: 'canceled',
          finishedAt,
          durationMs: 0,
          conversationId: run.conversationId as Id<'conversations'> | undefined,
          failureStage: 'preflight',
          errorCode: 'automation_inactive',
          errorMessage: 'Automation is no longer active.',
        },
        { throwOnError: true },
      )
      await appendEvent('failed', 'warning', 'Automation skipped because it is no longer active.')
      return NextResponse.json({ success: true, skipped: true })
    }

    if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled' || run.status === 'timed_out') {
      return NextResponse.json({ success: true, skipped: true })
    }

    let sourceInstructions = ''
    try {
      sourceInstructions = await loadAutomationSourceInstructions(automation, userId, serverSecret)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automation source is invalid.'
      const finishedAt = Date.now()
      await convex.mutation('automations:update', {
        automationId: automation._id as Id<'automations'>,
        userId,
        serverSecret,
        readinessState: 'invalid_source',
        readinessMessage: message,
      }, { throwOnError: true })
      await convex.mutation('automations:updateRun', {
        automationRunId: automationRunId as Id<'automationRuns'>,
        userId,
        serverSecret,
        status: 'failed',
        stage: 'needs_setup',
        finishedAt,
        durationMs: 0,
        conversationId: run.conversationId as Id<'conversations'> | undefined,
        readinessState: 'invalid_source',
        failureStage: 'preflight',
        errorCode: 'invalid_source',
        errorMessage: message,
      }, { throwOnError: true })
      await appendEvent('needs_setup', 'error', 'Automation source validation failed.', { error: message })
      return NextResponse.json({ error: message }, { status: 409 })
    }
    const prompt = buildAutomationRunPrompt(automation, sourceInstructions)
    const preflight = await runAutomationIntegrationPreflight({
      automation,
      sourceInstructions,
      userId,
    })
    if (!preflight.ok) {
      const finishedAt = Date.now()
      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'failed',
          stage: 'needs_setup',
          finishedAt,
          durationMs: 0,
          conversationId: run.conversationId as Id<'conversations'> | undefined,
          readinessState:
            preflight.errorCode === 'invalid_source'
              ? 'invalid_source'
              : preflight.errorCode === 'model_not_allowed'
                ? 'needs_setup'
                : 'needs_setup',
          failureStage: 'preflight',
          errorCode: preflight.errorCode,
          errorMessage: preflight.errorMessage,
        },
        { throwOnError: true },
      )
      await convex.mutation('automations:update', {
        automationId: automation._id as Id<'automations'>,
        userId,
        serverSecret,
        readinessState: preflight.errorCode === 'invalid_source' ? 'invalid_source' : 'needs_setup',
        readinessMessage: preflight.errorMessage,
      }, { throwOnError: true })
      await appendEvent('needs_setup', 'error', 'Automation preflight failed.', {
        errorCode: preflight.errorCode,
        errorMessage: preflight.errorMessage,
      })
      return NextResponse.json({ success: true, preflightFailed: true })
    }

    await convex.mutation('automations:update', {
      automationId: automation._id as Id<'automations'>,
      userId,
      serverSecret,
      readinessState: 'ready',
      readinessMessage: undefined,
    }, { throwOnError: true })

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
        stage: 'running',
        startedAt,
        conversationId,
        requestId,
        lastHeartbeatAt: startedAt,
        executor,
        readinessState: 'ready',
      },
      { throwOnError: true },
    )
    await appendEvent('running', 'info', 'Automation execution accepted by the executor.', {
      requestId,
      executor,
    })

    try {
      const result = await executeAutomationTurn({
        automation,
        baseUrl: getInternalApiBaseUrl(request),
        conversationId,
        prompt,
        userId,
        serverSecret,
        turnId: run.turnId || `automation-${Date.now()}`,
        requestId,
        executor,
        onEvent: (event) => appendEvent(event.stage, event.level, event.message, event.metadata),
        onHeartbeat: heartbeat,
      })
      const finishedAt = Date.now()

      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'succeeded',
          stage: 'succeeded',
          finishedAt,
          durationMs: finishedAt - startedAt,
          conversationId,
          turnId: result.turnId,
          assistantPersisted: true,
          assistantMessage: result.assistantMessage,
          requestId,
          executor,
          readinessState: 'ready',
          resultSummary: result.summary,
        },
        { throwOnError: true },
      )
      await appendEvent('succeeded', 'info', 'Automation run completed successfully.', {
        turnId: result.turnId,
      })

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
      const failureStage =
        error && typeof error === 'object' && 'failureStage' in error && typeof error.failureStage === 'string'
          ? error.failureStage
          : 'execute_model'

      await convex.mutation(
        'automations:updateRun',
        {
          automationRunId: automationRunId as Id<'automationRuns'>,
          userId,
          serverSecret,
          status: 'failed',
          stage: 'failed',
          finishedAt,
          durationMs: finishedAt - startedAt,
          conversationId,
          turnId,
          requestId,
          executor,
          failureStage,
          errorCode: 'scheduled_run_failed',
          errorMessage: message,
        },
        { throwOnError: true },
      )
      await appendEvent('failed', 'error', 'Automation execution failed.', {
        error: message,
        failureStage,
      })

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
