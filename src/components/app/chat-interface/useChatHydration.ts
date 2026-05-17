'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type {
  ConversationRuntime,
  LiveConversationMessage,
  LiveMessageDelta,
} from './types'

export function useChatHydration({
  activeChatId,
  userId,
  convexAccessToken,
  activeRuntime,
}: {
  activeChatId: string | null
  userId: string | undefined
  convexAccessToken: string | null | undefined
  activeRuntime: ConversationRuntime
}) {
  const liveMessages = useQuery(
    api.conversations.watchGeneratingMessages,
    activeChatId && userId && convexAccessToken
      ? {
          conversationId: activeChatId as Id<'conversations'>,
          userId,
          accessToken: convexAccessToken,
        }
      : 'skip',
  ) as Array<LiveConversationMessage> | undefined

  const liveMessageDeltas = useQuery(
    api.conversations.watchGeneratingMessageDeltas,
    activeChatId && userId && convexAccessToken
      ? {
          conversationId: activeChatId as Id<'conversations'>,
          userId,
          accessToken: convexAccessToken,
        }
      : 'skip',
  ) as Array<LiveMessageDelta> | undefined

  const activePersistedGenerating =
    (liveMessages ?? []).some(
      (message) => message.role === 'assistant' && message.status === 'generating',
    ) ||
    activeRuntime.actChat.messages.some((message) => {
      const m = message as unknown as { role?: string; status?: string }
      return m.role === 'assistant' && m.status === 'generating'
    }) ||
    activeRuntime.askChats.some((chat) =>
      chat.messages.some((message) => {
        const m = message as unknown as { role?: string; status?: string }
        return m.role === 'assistant' && m.status === 'generating'
      }),
    )

  return {
    liveMessages,
    liveMessageDeltas,
    activePersistedGenerating,
  }
}
