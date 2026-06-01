import 'server-only'

import { logger } from '@/server/observability/logger'
import { userFacingOpenRouterError } from '@/server/ai/model-runtime'
import {
  compactAssistantPersistenceForConvex,
} from '@/shared/chat/persist-assistant-turn'
import { summarizeErrorForLog } from '@/shared/security/safe-log'
import { emitChatFailed } from '@/server/shared/webhooks'
import type { ActConversationRepository } from './ActConversationRepository'
import type { Id } from '../../../convex/_generated/dataModel'

type UiStreamPersistenceEvent =
  | { kind: 'text-delta'; text: string }
  | { kind: 'reasoning-delta'; text: string }
  | {
      kind: 'tool-input'
      toolCallId: string
      toolName: string
      input: unknown
      state: 'input-available' | 'output-error'
      errorText?: string
    }
  | {
      kind: 'tool-output'
      toolCallId: string
      output: unknown
      state: 'output-available' | 'output-error' | 'output-denied'
      errorText?: string
    }

type ActGeneratingMessageEvents = {
  failed(params: {
    conversationId?: Id<'conversations'>
    error: string
    turnId?: string
    userId: string
  }): void
}

const defaultEvents: ActGeneratingMessageEvents = {
  failed: emitChatFailed,
}

function extractUiStreamPersistenceEvents(chunkText: string): UiStreamPersistenceEvent[] {
  const events: UiStreamPersistenceEvent[] = []
  const lines = chunkText.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line
    if (!payload || payload === '[DONE]') continue
    try {
      const evt = JSON.parse(payload) as {
        type?: string
        delta?: unknown
        text?: unknown
        toolCallId?: unknown
        toolName?: unknown
        input?: unknown
        output?: unknown
        errorText?: unknown
      }
      if (
        (evt.type === 'text-delta' || evt.type === 'text') &&
        typeof evt.delta === 'string'
      ) {
        events.push({ kind: 'text-delta', text: evt.delta })
      } else if (evt.type === 'text-delta' && typeof evt.text === 'string') {
        events.push({ kind: 'text-delta', text: evt.text })
      } else if (evt.type === 'reasoning-delta' && typeof evt.delta === 'string') {
        events.push({ kind: 'reasoning-delta', text: evt.delta })
      } else if (evt.type === 'reasoning-delta' && typeof evt.text === 'string') {
        events.push({ kind: 'reasoning-delta', text: evt.text })
      } else if (
        (evt.type === 'tool-input-available' || evt.type === 'tool-input-error') &&
        typeof evt.toolCallId === 'string' &&
        typeof evt.toolName === 'string'
      ) {
        events.push({
          kind: 'tool-input',
          toolCallId: evt.toolCallId,
          toolName: evt.toolName,
          input: evt.input,
          state: evt.type === 'tool-input-error' ? 'output-error' : 'input-available',
          errorText: typeof evt.errorText === 'string' ? evt.errorText : undefined,
        })
      } else if (
        (evt.type === 'tool-output-available' ||
          evt.type === 'tool-output-error' ||
          evt.type === 'tool-output-denied') &&
        typeof evt.toolCallId === 'string'
      ) {
        events.push({
          kind: 'tool-output',
          toolCallId: evt.toolCallId,
          output: evt.output,
          state:
            evt.type === 'tool-output-error'
              ? 'output-error'
              : evt.type === 'tool-output-denied'
                ? 'output-denied'
                : 'output-available',
          errorText: typeof evt.errorText === 'string' ? evt.errorText : undefined,
        })
      }
    } catch (_error) {
      // Ignore partial chunks and non-JSON protocol frames.
    }
  }
  return events
}

function partsFromPersistenceEvents(events: UiStreamPersistenceEvent[]): Array<Record<string, unknown>> {
  const newParts: Array<Record<string, unknown>> = []
  for (const event of events) {
    if (event.kind === 'reasoning-delta') {
      newParts.push({ type: 'reasoning', text: event.text, state: 'streaming' })
    } else if (event.kind === 'tool-input') {
      newParts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          state: event.state,
          toolInput: event.input,
          ...(event.errorText ? { toolOutput: { error: event.errorText } } : {}),
        },
      })
    } else if (event.kind === 'tool-output') {
      newParts.push({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: event.toolCallId,
          toolName: 'unknown_tool',
          state: event.state,
          toolOutput: event.state === 'output-error'
            ? { error: event.errorText ?? 'Tool call failed.' }
            : event.output,
        },
      })
    }
  }
  return newParts
}

export class ActGeneratingMessageService {
  private readonly events: ActGeneratingMessageEvents

  constructor(private readonly deps: {
    events?: ActGeneratingMessageEvents
    repository: ActConversationRepository
  }) {
    this.events = deps.events ?? defaultEvents
  }

  async start(args: {
    conversationId?: Id<'conversations'>
    modelId: string
    multiModelSlotIndex: number
    multiModelTotal: number
    turnId: string
    userId: string
  }): Promise<Id<'conversationMessages'> | undefined> {
    if (!args.conversationId) return undefined
    try {
      return await this.deps.repository.startGeneratingMessage({
        conversationId: args.conversationId,
        userId: args.userId,
        turnId: args.turnId,
        mode: 'act',
        modelId: args.modelId,
        variantIndex: args.multiModelTotal > 1 ? args.multiModelSlotIndex : undefined,
      }) ?? undefined
    } catch (err) {
      logger.error('[conversations/act] Failed to start generating assistant message:', summarizeErrorForLog(err))
      return undefined
    }
  }

  async finalize(args: {
    content: string
    messageId: Id<'conversationMessages'>
    parts: Array<Record<string, unknown>>
    routedModelId?: string
    tokens: { input: number; output: number }
  }): Promise<void> {
    await this.deps.repository.finalizeGeneratingMessage(args)
  }

  async fail(args: {
    conversationId?: Id<'conversations'>
    emitWebhook: boolean
    error: unknown
    messageId?: Id<'conversationMessages'>
    turnId?: string
    userId?: string
  }): Promise<void> {
    if (!args.messageId) return
    const errorText = userFacingOpenRouterError(args.error)
    try {
      await this.deps.repository.failGeneratingMessage({
        messageId: args.messageId,
        errorText,
      })
      if (args.emitWebhook && args.userId) {
        this.events.failed({
          userId: args.userId,
          conversationId: args.conversationId,
          turnId: args.turnId,
          error: errorText,
        })
      }
    } catch (err) {
      logger.error('[conversations/act] Failed to mark generating message failed:', summarizeErrorForLog(err))
    }
  }

  createPersistenceTransform(params: {
    messageId?: Id<'conversationMessages'>
  }) {
    const decoder = new TextDecoder()
    let textBuffer = ''
    let pendingText = ''
    let lastFlushAt = Date.now()

    const flushText = async (force = false) => {
      if (!params.messageId || !pendingText) return
      if (!force && pendingText.length < 600 && Date.now() - lastFlushAt < 1500) return
      const textDelta = pendingText
      pendingText = ''
      lastFlushAt = Date.now()
      try {
        await this.deps.repository.appendGeneratingMessageDelta({
          messageId: params.messageId,
          textDelta,
        })
      } catch (err) {
        logger.error('[conversations/act] Failed to append generating text:', summarizeErrorForLog(err))
      }
    }

    const flushParts = async (events: UiStreamPersistenceEvent[], label: string) => {
      if (!params.messageId) return
      const newParts = partsFromPersistenceEvents(events)
      if (newParts.length === 0) return
      try {
        const compactedParts = compactAssistantPersistenceForConvex({
          content: '',
          parts: newParts,
        }).parts
        await this.deps.repository.appendGeneratingMessageDelta({
          messageId: params.messageId,
          newParts: compactedParts,
        })
      } catch (err) {
        logger.error(`[conversations/act] Failed to ${label} generating parts:`, summarizeErrorForLog(err))
      }
    }

    return new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, controller) {
        controller.enqueue(chunk)
        if (!params.messageId) return
        textBuffer += decoder.decode(chunk, { stream: true })
        const split = textBuffer.split(/\r?\n/)
        textBuffer = split.pop() ?? ''
        const events = extractUiStreamPersistenceEvents(split.join('\n'))
        for (const event of events) {
          if (event.kind === 'text-delta') pendingText += event.text
        }
        await flushParts(events, 'append')
        await flushText(false)
      },
      async flush() {
        if (textBuffer) {
          const events = extractUiStreamPersistenceEvents(textBuffer)
          for (const event of events) {
            if (event.kind === 'text-delta') pendingText += event.text
          }
          await flushParts(events, 'flush')
          textBuffer = ''
        }
        await flushText(true)
      },
    })
  }
}
