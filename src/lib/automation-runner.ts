import { convex } from '@/lib/convex'
import {
  buildAutomationPrompt,
  formatAutomationSchedule,
  type AutomationSummary,
} from '@/lib/automations'
import type { Id } from '../../convex/_generated/dataModel'

export function buildUiMessage(prompt: string, turnId: string) {
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

export function summarizeAssistantMessage(content: string | undefined): string | undefined {
  const trimmed = content?.trim()
  if (!trimmed) return undefined
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed
}

export async function ensureAutomationConversation(args: {
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

  const created = await convex.mutation<Id<'conversations'>>(
    'conversations:create',
    {
      userId,
      serverSecret,
      title: `Automation: ${automation.title}`,
      projectId: automation.projectId,
      askModelIds: [automation.modelId],
      actModelId: automation.modelId,
      lastMode: automation.mode,
    },
    { throwOnError: true },
  )
  if (!created) {
    throw new Error('Failed to create automation conversation')
  }

  await convex.mutation(
    'automations:update',
    {
      automationId: automation._id as Id<'automations'>,
      userId,
      serverSecret,
      conversationId: created,
    },
    { throwOnError: true },
  )

  return created
}

export async function loadAutomationSourceInstructions(
  automation: AutomationSummary,
  userId: string,
  serverSecret: string,
) {
  if (automation.sourceType === 'inline') {
    return automation.instructionsMarkdown?.trim() || ''
  }

  if (!automation.skillId) {
    throw new Error('Automation is missing skillId')
  }

  const skill = await convex.query<{ instructions: string } | null>(
    'skills:get',
    {
      skillId: automation.skillId as Id<'skills'>,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  )

  if (!skill?.instructions?.trim()) {
    throw new Error('Referenced skill was not found')
  }

  return skill.instructions.trim()
}

export function buildAutomationRunPrompt(automation: AutomationSummary, sourceInstructions: string) {
  const scheduleLabel = formatAutomationSchedule(
    automation.scheduleKind,
    automation.scheduleConfig,
    automation.timezone,
  )

  return buildAutomationPrompt({
    title: automation.title,
    description: automation.description,
    scheduleLabel,
    timezone: automation.timezone,
    sourceInstructions,
  })
}

export async function executeAutomationTurn(args: {
  automation: AutomationSummary
  baseUrl: string
  internalApiSecret: string
  conversationId: Id<'conversations'>
  prompt: string
  userId: string
  serverSecret: string
}) {
  const { automation, baseUrl, internalApiSecret, conversationId, prompt, userId, serverSecret } = args
  const endpoint = automation.mode === 'act'
    ? '/api/app/conversations/act'
    : '/api/app/conversations/ask'
  const turnId = `automation-${Date.now()}`

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-secret': internalApiSecret,
    },
    body: JSON.stringify({
      conversationId,
      turnId,
      modelId: automation.modelId,
      messages: buildUiMessage(prompt, turnId),
      userId,
    }),
  })

  const bodyText = await response.text()
  if (!response.ok) {
    throw new Error(bodyText || 'Automation execution failed')
  }

  const messages = await convex.query<
    Array<{
      turnId: string
      role: 'user' | 'assistant'
      content: string
    }>
  >(
    'conversations:getMessages',
    {
      conversationId,
      userId,
      serverSecret,
    },
    { throwOnError: true },
  )

  const assistantMessage = [...(messages ?? [])]
    .reverse()
    .find((message) => message.turnId === turnId && message.role === 'assistant')

  return {
    turnId,
    summary: summarizeAssistantMessage(assistantMessage?.content),
  }
}
