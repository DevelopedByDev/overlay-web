import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiBaseUrl } from '@/lib/url'
import {
  buildAutomationPrompt,
  formatAutomationSchedule,
  type AutomationSummary,
} from '@/lib/automations'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export const maxDuration = 300

function buildUiMessage(prompt: string, turnId: string) {
  return [
    {
      id: turnId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: prompt,
        },
      ],
    },
  ]
}

function summarizeAssistantMessage(content: string | undefined): string | undefined {
  const trimmed = content?.trim()
  if (!trimmed) return undefined
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed
}

async function ensureConversation(args: {
  userId: string
  serverSecret: string
  automation: AutomationSummary
}) {
  const { automation, userId, serverSecret } = args

  if (automation.conversationId) {
    const existing = await convex.query('conversations:get', {
      conversationId: automation.conversationId as Id<'conversations'>,
      userId,
      serverSecret,
    })
    if (existing) {
      return automation.conversationId as Id<'conversations'>
    }
  }

  const created = await convex.mutation<Id<'conversations'>>('conversations:create', {
    userId,
    serverSecret,
    title: `Automation: ${automation.title}`,
    projectId: automation.projectId,
    askModelIds: [automation.modelId],
    actModelId: automation.modelId,
    lastMode: automation.mode,
  }, { throwOnError: true })
  if (!created) {
    throw new Error('Failed to create automation conversation')
  }

  await convex.mutation('automations:update', {
    automationId: automation._id as Id<'automations'>,
    userId,
    serverSecret,
    conversationId: created,
  }, { throwOnError: true })

  return created
}

async function loadSourceInstructions(automation: AutomationSummary, userId: string, serverSecret: string) {
  if (automation.sourceType === 'inline') {
    return automation.instructionsMarkdown?.trim() || ''
  }

  if (!automation.skillId) {
    throw new Error('Automation is missing skillId')
  }

  const skill = await convex.query<{
    instructions: string
  } | null>('skills:get', {
    skillId: automation.skillId as Id<'skills'>,
    userId,
    serverSecret,
  }, { throwOnError: true })

  if (!skill?.instructions?.trim()) {
    throw new Error('Referenced skill was not found')
  }

  return skill.instructions.trim()
}

async function executeAutomationTurn(args: {
  request: NextRequest
  automation: AutomationSummary
  conversationId: Id<'conversations'>
  prompt: string
}) {
  const { request, automation, conversationId, prompt } = args
  const baseUrl = getInternalApiBaseUrl(request)
  const endpoint = automation.mode === 'act'
    ? '/api/app/conversations/act'
    : '/api/app/conversations/ask'
  const turnId = `automation-${Date.now()}`

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.headers.get('cookie')
        ? { cookie: request.headers.get('cookie') as string }
        : {}),
    },
    body: JSON.stringify({
      conversationId,
      turnId,
      modelId: automation.modelId,
      messages: buildUiMessage(prompt, turnId),
    }),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(bodyText || 'Automation execution failed')
  }

  const messages = await convex.query<Array<{
    turnId: string
    role: 'user' | 'assistant'
    content: string
  }>>('conversations:getMessages', {
    conversationId,
    userId: automation.userId,
    serverSecret: getInternalApiSecret(),
  }, { throwOnError: true })

  const assistantMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => message.turnId === turnId && message.role === 'assistant')

  return {
    turnId,
    summary: summarizeAssistantMessage(assistantMessage?.content),
  }
}

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

    const sourceInstructions = await loadSourceInstructions(automation, userId, serverSecret)
    const scheduleLabel = formatAutomationSchedule(
      automation.scheduleKind,
      automation.scheduleConfig,
      automation.timezone,
    )
    const prompt = buildAutomationPrompt({
      title: automation.title,
      description: automation.description,
      scheduleLabel,
      timezone: automation.timezone,
      sourceInstructions,
    })

    const conversationId = await ensureConversation({
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
        request,
        automation,
        conversationId,
        prompt,
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
