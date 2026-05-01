import type { UIMessage } from 'ai'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { buildServiceAuthToken, getServiceAuthHeaderName } from '@/lib/service-auth'
import { getBaseUrl } from '@/lib/url'
import { DEFAULT_MODEL_ID } from '@/lib/models'
import type { Id } from '../../../convex/_generated/dataModel'

export type ScheduledAutomationTurn = {
  runId: string
  userId: string
  name: string
  description?: string
  instructions: string
  projectId?: string
  modelId?: string
  turnId: string
  scheduledFor: number
}

async function drainResponseBody(response: Response): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  try {
    while (!(await reader.read()).done) {
      // Keep consuming the UI stream so the existing act route can finish and persist.
    }
  } finally {
    reader.releaseLock()
  }
}

function buildAutomationUserMessage(input: ScheduledAutomationTurn): string {
  const scheduledAt = new Date(input.scheduledFor).toISOString()
  return [
    `Run scheduled automation: ${input.name}`,
    input.description ? `Description: ${input.description}` : '',
    `Scheduled for: ${scheduledAt}`,
    '',
    'Stored automation instructions:',
    input.instructions,
  ].filter(Boolean).join('\n')
}

function buildAutomationSystemPrompt(input: ScheduledAutomationTurn): string {
  return [
    'You are running a scheduled automation for the user.',
    'Execute the stored automation instructions without asking clarifying questions.',
    'If required auth, context, or tool access is missing, stop and write a concise failure summary.',
    'Only use tools that are clearly authorized by the stored automation and connected for this user.',
    'End with a concise summary of what was completed and what still needs attention.',
    '',
    `Automation name: ${input.name}`,
    input.description ? `Automation description: ${input.description}` : '',
  ].filter(Boolean).join('\n')
}

export async function runActTurnForScheduledAutomation(input: ScheduledAutomationTurn): Promise<{
  conversationId: Id<'conversations'>
}> {
  const serverSecret = getInternalApiSecret()
  const title = `Automation: ${input.name}`
  const conversationId = await convex.mutation<Id<'conversations'>>(
    'conversations:create',
    {
      userId: input.userId,
      serverSecret,
      title,
      projectId: input.projectId,
      askModelIds: [input.modelId || DEFAULT_MODEL_ID],
      actModelId: input.modelId || DEFAULT_MODEL_ID,
      lastMode: 'act',
    },
    { throwOnError: true },
  )

  if (!conversationId) {
    throw new Error('Failed to create automation conversation')
  }

  const message: UIMessage = {
    id: input.turnId,
    role: 'user',
    parts: [{ type: 'text', text: buildAutomationUserMessage(input) }],
  }
  const path = '/api/app/conversations/act'
  const serviceToken = await buildServiceAuthToken({
    userId: input.userId,
    method: 'POST',
    path,
  })
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [getServiceAuthHeaderName()]: serviceToken,
    },
    body: JSON.stringify({
      messages: [message],
      systemPrompt: buildAutomationSystemPrompt(input),
      conversationId,
      turnId: input.turnId,
      modelId: input.modelId || DEFAULT_MODEL_ID,
      userId: input.userId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `Act route failed with ${response.status}`)
  }

  await drainResponseBody(response)
  return { conversationId }
}
