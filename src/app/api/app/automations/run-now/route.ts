import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiBaseUrl } from '@/lib/url'
import { type AutomationSummary } from '@/lib/automations'
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
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { automationId } = (await request.json()) as { automationId?: string }
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const userId = session.user.id
    const serverSecret = getInternalApiSecret()
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
      triggerSource: 'manual',
      scheduledFor: Date.now(),
      promptSnapshot: prompt,
      mode: automation.mode,
      modelId: automation.modelId,
      conversationId,
      startedAt,
    }, { throwOnError: true })

    await convex.mutation('automations:update', {
      automationId: automation._id as Id<'automations'>,
      userId,
      serverSecret,
      lastRunStatus: 'running',
    }, { throwOnError: true })

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

      await convex.mutation('automations:updateRun', {
        automationRunId: runId,
        userId,
        serverSecret,
        status: 'succeeded',
        finishedAt,
        durationMs: finishedAt - startedAt,
        conversationId,
        resultSummary: result.summary,
      }, { throwOnError: true })

      return NextResponse.json({
        success: true,
        automationRunId: runId,
        conversationId,
        resultSummary: result.summary,
      })
    } catch (error) {
      const finishedAt = Date.now()
      const message = error instanceof Error ? error.message : 'Automation execution failed'

      await convex.mutation('automations:updateRun', {
        automationRunId: runId,
        userId,
        serverSecret,
        status: 'failed',
        finishedAt,
        durationMs: finishedAt - startedAt,
        conversationId,
        errorCode: 'manual_run_failed',
        errorMessage: message,
      }, { throwOnError: true })

      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('[automation run-now] POST error:', error)
    return NextResponse.json({ error: 'Failed to run automation' }, { status: 500 })
  }
}
