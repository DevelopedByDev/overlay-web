import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { getInternalApiBaseUrl } from '@/lib/url'
import { resolveAutomationExecutorMetadata } from '@/lib/automation-execution'
import { type AutomationSummary } from '@/lib/automations'
import { runAutomationIntegrationPreflight } from '@/lib/automation-preflight'
import {
  buildAutomationRunPrompt,
  ensureAutomationConversation,
  executeAutomationTurn,
  loadAutomationSourceInstructions,
} from '@/lib/automation-runner'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  try {
    const body = (await request.json()) as { automationId?: string; accessToken?: string; userId?: string }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { automationId } = body
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const userId = auth.userId
    const serverSecret = getInternalApiSecret()
    const executor = resolveAutomationExecutorMetadata(request.headers)
    const automation = await convex.query<AutomationSummary | null>('automations:get', {
      automationId: automationId as Id<'automations'>,
      userId,
      serverSecret,
    }, { throwOnError: true })

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    const sourceInstructions = await loadAutomationSourceInstructions(automation, userId, serverSecret)
    const prompt = buildAutomationRunPrompt(automation, sourceInstructions)
    let preflight
    try {
      preflight = await runAutomationIntegrationPreflight({
        automation,
        sourceInstructions,
        userId,
      })
    } catch (preflightError) {
      const message = preflightError instanceof Error ? preflightError.message : 'Preflight check failed'
      console.error('[automation run-now] preflight error:', preflightError)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const scheduledFor = Date.now()
    const failedAt = Date.now()
    if (!preflight.ok) {
      const runId = await convex.mutation<Id<'automationRuns'>>('automations:createRun', {
        automationId: automation._id as Id<'automations'>,
        userId,
        serverSecret,
        status: 'failed',
        stage: 'needs_setup',
        triggerSource: 'manual',
        scheduledFor,
        promptSnapshot: prompt,
        mode: automation.mode,
        modelId: automation.modelId,
      }, { throwOnError: true })

      await convex.mutation('automations:updateRun', {
        automationRunId: runId,
        userId,
        serverSecret,
        status: 'failed',
        stage: 'needs_setup',
        finishedAt: failedAt,
        durationMs: 0,
        readinessState: preflight.errorCode === 'invalid_source' ? 'invalid_source' : 'needs_setup',
        failureStage: 'preflight',
        errorCode: preflight.errorCode,
        errorMessage: preflight.errorMessage,
      }, { throwOnError: true })
      await convex.mutation('automations:update', {
        automationId: automation._id as Id<'automations'>,
        userId,
        serverSecret,
        readinessState: preflight.errorCode === 'invalid_source' ? 'invalid_source' : 'needs_setup',
        readinessMessage: preflight.errorMessage,
      }, { throwOnError: true })
      await convex.mutation('automations:appendRunEvent', {
        automationRunId: runId,
        userId,
        serverSecret,
        stage: 'needs_setup',
        level: 'error',
        message: 'Manual automation run failed preflight.',
        metadata: { errorCode: preflight.errorCode, errorMessage: preflight.errorMessage },
      }, { throwOnError: true })

      return NextResponse.json(
        { error: preflight.errorMessage, automationRunId: runId },
        { status: 409 },
      )
    }

    const conversationId = await ensureAutomationConversation({
      userId,
      serverSecret,
      automation,
    })

    const runId = await convex.mutation<Id<'automationRuns'>>('automations:createRun', {
      automationId: automation._id as Id<'automations'>,
      userId,
      serverSecret,
      status: 'running',
      stage: 'running',
      triggerSource: 'manual',
      scheduledFor,
      promptSnapshot: prompt,
      mode: automation.mode,
      modelId: automation.modelId,
      conversationId,
      startedAt,
      requestId: `manual-${automation._id}-${startedAt}`,
      lastHeartbeatAt: startedAt,
      executor,
      readinessState: 'ready',
    }, { throwOnError: true })

    await convex.mutation('automations:update', {
      automationId: automation._id as Id<'automations'>,
      userId,
      serverSecret,
      lastRunStatus: 'running',
      readinessState: 'ready',
      readinessMessage: undefined,
    }, { throwOnError: true })
    await convex.mutation('automations:appendRunEvent', {
      automationRunId: runId,
      userId,
      serverSecret,
      stage: 'running',
      level: 'info',
      message: 'Manual automation run started.',
      metadata: { executor },
    }, { throwOnError: true })

    const appendEvent = async (
      stage: 'dispatching' | 'running' | 'persisting' | 'succeeded' | 'failed' | 'needs_setup',
      level: 'info' | 'warning' | 'error',
      message: string,
      metadata?: Record<string, unknown>,
    ) => {
      await convex.mutation('automations:appendRunEvent', {
        automationRunId: runId,
        userId,
        serverSecret,
        stage,
        level,
        message,
        metadata,
      }, { throwOnError: true })
    }

    try {
      const result = await executeAutomationTurn({
        automation,
        baseUrl: getInternalApiBaseUrl(request),
        conversationId,
        prompt,
        userId,
        serverSecret,
        turnId: `automation-${Date.now()}`,
        requestId: `manual-${automation._id}-${startedAt}`,
        executor,
        onEvent: (event) => appendEvent(event.stage, event.level, event.message, event.metadata),
        onHeartbeat: async (stage) => {
          await convex.mutation('automations:updateRunHeartbeat', {
            automationRunId: runId,
            userId,
            serverSecret,
            ...(stage ? { stage } : {}),
            lastHeartbeatAt: Date.now(),
          }, { throwOnError: true })
        },
      })
      const finishedAt = Date.now()

      await convex.mutation('automations:updateRun', {
        automationRunId: runId,
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
        executor,
        readinessState: 'ready',
        resultSummary: result.summary,
      }, { throwOnError: true })
      await appendEvent('succeeded', 'info', 'Manual automation run completed successfully.', {
        turnId: result.turnId,
      })

      return NextResponse.json({
        success: true,
        automationRunId: runId,
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

      await convex.mutation('automations:updateRun', {
        automationRunId: runId,
        userId,
        serverSecret,
        status: 'failed',
        stage: 'failed',
        finishedAt,
        durationMs: finishedAt - startedAt,
        conversationId,
        turnId,
        failureStage,
        executor,
        errorCode: 'manual_run_failed',
        errorMessage: message,
      }, { throwOnError: true })
      await appendEvent('failed', 'error', 'Manual automation run failed.', {
        error: message,
        failureStage,
      })

      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run automation'
    console.error('[automation run-now] POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
