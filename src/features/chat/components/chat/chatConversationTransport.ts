import { overlayAppClient } from '@/lib/overlay-app-client'
import type { ChatMessageMetadata, ChatOutput } from '../chat-interface/types'

export type RawConversationMessage = {
  id: string
  turnId?: string
  mode?: 'ask' | 'act'
  role: 'user' | 'assistant'
  parts: Array<{
    type: string
    text?: string
    url?: string
    mediaType?: string
    fileName?: string
  }>
  model?: string
  metadata?: ChatMessageMetadata
  replyToTurnId?: string
  replySnippet?: string
  routedModelId?: string
  status?: 'generating' | 'completed' | 'error'
  variantIndex?: number
}

export interface ConversationMetaSnapshot {
  title?: string
  lastMode?: 'ask' | 'act'
  askModelIds?: string[]
  actModelId?: string
}

export type ConversationLoadSnapshot =
  | {
      status: 'ok'
      messages: RawConversationMessage[]
      outputs: ChatOutput[]
      meta: ConversationMetaSnapshot | null
    }
  | { status: 'missing' }
  | { status: 'error' }

export async function loadConversationSnapshot({
  chatId,
  shouldLoadMeta,
}: {
  chatId: string
  shouldLoadMeta: boolean
}): Promise<ConversationLoadSnapshot> {
  const [messagesRes, outputsRes, metaRes] = await Promise.all([
    overlayAppClient.conversations.getResponse({
      conversationId: chatId,
      messages: true,
    }),
    overlayAppClient.files.getResponse({ kind: 'output', conversationId: chatId }),
    shouldLoadMeta
      ? overlayAppClient.conversations.getResponse({ conversationId: chatId })
      : Promise.resolve(null),
  ])

  if (metaRes?.status === 404 || messagesRes.status === 404) {
    return { status: 'missing' }
  }
  if (!messagesRes.ok) {
    return { status: 'error' }
  }

  const data = await messagesRes.json()
  const rawMessages = Array.isArray(data.messages)
    ? data.messages as RawConversationMessage[]
    : []

  const outputRows = outputsRes.ok ? await outputsRes.json() : []
  const outputs: ChatOutput[] = Array.isArray(outputRows)
    ? outputRows.map((file: {
        _id: string
        outputType?: string
        prompt?: string
        modelId?: string
        downloadUrl?: string
        createdAt?: number
        updatedAt?: number
        turnId?: string
      }) => ({
        _id: file._id,
        type: (file.outputType || 'document') as ChatOutput['type'],
        status: 'completed',
        prompt: file.prompt || 'Generated output',
        modelId: file.modelId || '',
        url: file.downloadUrl,
        createdAt: file.createdAt ?? file.updatedAt ?? 0,
        turnId: file.turnId,
      }))
    : []

  const meta = metaRes?.ok
    ? await metaRes.json() as ConversationMetaSnapshot
    : null

  return {
    status: 'ok',
    messages: rawMessages,
    outputs,
    meta,
  }
}

export function normalizeReplyMetadata(messages: RawConversationMessage[]): RawConversationMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'user' || !msg.replyToTurnId?.trim()) return msg
    return {
      ...msg,
      metadata: {
        ...(msg.metadata ?? {}),
        replyToTurnId: msg.replyToTurnId.trim(),
        ...(msg.replySnippet ? { replySnippet: msg.replySnippet } : {}),
      },
    }
  })
}
