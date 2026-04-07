import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type {
  AutomationOutputSummary,
  AutomationRunDetail,
  AutomationRunSummary,
  AutomationSummary,
  AutomationToolInvocationSummary,
} from '@/lib/automations'
import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { getSession } from '@/lib/workos-auth'

type ConversationMessage = {
  turnId: string
  role: 'user' | 'assistant'
  content: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const automationRunId = request.nextUrl.searchParams.get('automationRunId')
    if (!automationRunId) {
      return NextResponse.json({ error: 'automationRunId required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const userId = session.user.id

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

    const [automation, messages, outputs, tools, relatedRetryRun] = await Promise.all([
      convex.query<AutomationSummary | null>(
        'automations:get',
        {
          automationId: run.automationId as Id<'automations'>,
          userId,
          serverSecret,
        },
        { throwOnError: true },
      ),
      run.conversationId
        ? convex.query<ConversationMessage[]>(
            'conversations:getMessages',
            {
              conversationId: run.conversationId as Id<'conversations'>,
              userId,
              serverSecret,
            },
            { throwOnError: true },
          )
        : Promise.resolve([]),
      run.turnId
        ? convex.query<AutomationOutputSummary[]>(
            'outputs:listByTurnId',
            {
              turnId: run.turnId,
              userId,
              serverSecret,
            },
            { throwOnError: true },
          )
        : Promise.resolve([]),
      run.turnId
        ? convex.query<AutomationToolInvocationSummary[]>(
            'usage:listToolInvocations',
            {
              userId,
              serverSecret,
              turnId: run.turnId,
              limit: 50,
            },
            { throwOnError: true },
          )
        : Promise.resolve([]),
      convex.query<AutomationRunSummary | null>(
        'automations:findRetryRun',
        {
          automationId: run.automationId as Id<'automations'>,
          automationRunId: run._id as Id<'automationRuns'>,
          userId,
          serverSecret,
        },
        { throwOnError: true },
      ),
    ])

    const runMessages = run.turnId
      ? (messages ?? []).filter((message) => message.turnId === run.turnId)
      : []
    const userMessage = runMessages.find((message) => message.role === 'user')?.content
    const assistantMessage = [...runMessages]
      .reverse()
      .find((message) => message.role === 'assistant')?.content

    const detail: AutomationRunDetail = {
      run,
      automation: automation
        ? {
            _id: automation._id,
            title: automation.title,
            description: automation.description,
            mode: automation.mode,
            modelId: automation.modelId,
          }
        : undefined,
      userMessage,
      assistantMessage,
      outputs: outputs ?? [],
      tools: tools ?? [],
      relatedRetryRun: relatedRetryRun ?? undefined,
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[automation run detail] GET error:', error)
    return NextResponse.json({ error: 'Failed to load automation run detail' }, { status: 500 })
  }
}
