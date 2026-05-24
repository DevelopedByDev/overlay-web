import 'server-only'

import type { WebhookEvent, WebhookEventType } from '@/shared/schemas/webhooks'
import { dispatchWebhookEvent } from './webhook-dispatcher'

function fireAndForget(promise: Promise<unknown>, label: string): void {
  promise.catch((error) => {
    console.warn(`[webhooks] ${label} failed`, error)
  })
}

export function emitWebhookEvent(
  userId: string,
  type: WebhookEventType,
  data: Record<string, unknown>,
  eventId: string,
): void {
  const event: WebhookEvent = {
    id: eventId,
    type,
    createdAt: Date.now(),
    userId,
    data,
  }
  fireAndForget(dispatchWebhookEvent(userId, event), type)
}

export function emitChatCompleted(params: {
  userId: string
  conversationId: string
  turnId: string
  modelId?: string
}): void {
  emitWebhookEvent(
    params.userId,
    'chat.completed',
    {
      conversationId: params.conversationId,
      turnId: params.turnId,
      ...(params.modelId ? { modelId: params.modelId } : {}),
    },
    `chat.completed:${params.userId}:${params.conversationId}:${params.turnId}`,
  )
}

export function emitChatFailed(params: {
  userId: string
  conversationId?: string
  turnId?: string
  error: string
  modelId?: string
}): void {
  const scope = params.conversationId && params.turnId
    ? `${params.userId}:${params.conversationId}:${params.turnId}`
    : `${params.userId}:${Date.now()}`
  emitWebhookEvent(
    params.userId,
    'chat.failed',
    {
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      ...(params.turnId ? { turnId: params.turnId } : {}),
      error: params.error,
      ...(params.modelId ? { modelId: params.modelId } : {}),
    },
    `chat.failed:${scope}`,
  )
}

export function emitAutomationFinished(params: {
  userId: string
  automationId: string
  runId: string
  conversationId?: string
}): void {
  emitWebhookEvent(
    params.userId,
    'automation.finished',
    {
      automationId: params.automationId,
      runId: params.runId,
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    },
    `automation.finished:${params.runId}`,
  )
}

export function emitAutomationFailed(params: {
  userId: string
  automationId: string
  runId: string
  error: string
  conversationId?: string
}): void {
  emitWebhookEvent(
    params.userId,
    'automation.failed',
    {
      automationId: params.automationId,
      runId: params.runId,
      error: params.error,
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    },
    `automation.failed:${params.runId}`,
  )
}
