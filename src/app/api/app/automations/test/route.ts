import { NextRequest, NextResponse } from 'next/server'
import { runActTurnForScheduledAutomation } from '@/lib/agent/run-act-turn'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const maxDuration = 300

type AutomationRunTarget = {
  _id: Id<'automations'>
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

function summarizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown automation error'
  }
}

export async function POST(request: NextRequest) {
  let runId: Id<'automationRuns'> | null = null
  let userId: string | null = null

  try {
    const body = await request.json().catch(() => ({})) as {
      accessToken?: string
      userId?: string
      automationId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = auth.userId

    if (!body.automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const automationId = body.automationId as Id<'automations'>
    const automation = await convex.query('automations:get', {
      automationId,
      userId: auth.userId,
      serverSecret,
    }) as AutomationRunTarget | null

    if (!automation) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

    const name = (automation.name || automation.title || 'Untitled automation').trim()
    const instructions = (automation.instructions || automation.instructionsMarkdown || '').trim()
    if (!instructions) {
      return NextResponse.json({ error: 'Automation has no instructions to test' }, { status: 400 })
    }

    const scheduledFor = Date.now()
    const turnId = `automation-test-${automationId}-${scheduledFor}`
    const conversationId = (automation.sourceConversationId || automation.conversationId) as
      | Id<'conversations'>
      | undefined

    runId = await convex.mutation('automations:createManualRun', {
      automationId,
      userId: auth.userId,
      serverSecret,
      scheduledFor,
    }, { throwOnError: true }) as Id<'automationRuns'>

    await convex.mutation('automations:markManualRunStarted', {
      runId,
      userId: auth.userId,
      serverSecret,
      conversationId,
      turnId,
      now: Date.now(),
    }, { throwOnError: true })

    const result = await runActTurnForScheduledAutomation({
      runId,
      userId: auth.userId,
      name,
      description: automation.description || '',
      instructions,
      projectId: automation.projectId,
      modelId: automation.modelId,
      conversationId,
      turnId,
      scheduledFor,
    })

    await convex.mutation('automations:markManualRunCompleted', {
      runId,
      userId: auth.userId,
      serverSecret,
      conversationId: result.conversationId,
      now: Date.now(),
    }, { throwOnError: true })

    return NextResponse.json({
      success: true,
      runId,
      conversationId: result.conversationId,
    })
  } catch (error) {
    const message = summarizeError(error).slice(0, 1000)
    if (runId && userId) {
      await convex.mutation('automations:markManualRunFailed', {
        runId,
        userId,
        serverSecret: getInternalApiSecret(),
        error: message,
        now: Date.now(),
      }).catch(() => null)
    }
    console.error('[automations/test]', error)
    return NextResponse.json({ error: 'Failed to test automation', message }, { status: 500 })
  }
}
