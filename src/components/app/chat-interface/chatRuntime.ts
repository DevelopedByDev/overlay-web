import { Chat } from '@ai-sdk/react'
import { createConversationUiState } from '@overlay/chat-core'
import { createPersistentChatTransport } from '@/lib/cloudflare-chat-transport'
import type { ConversationRuntime, ConversationUiState } from './types'

export function createConversationRuntime(
  chatId: string,
  uiOverrides: Partial<ConversationUiState> = {},
): ConversationRuntime {
  const actTransport = '/api/app/conversations/act'
  const transport = () => createPersistentChatTransport({
    api: actTransport,
    prepareSendMessagesRequest: ({ api, id, messages, body, headers, credentials, trigger, messageId }) => ({
      api,
      headers,
      credentials,
      body: {
        ...body,
        id,
        messages: messages.at(-1) ? [messages.at(-1)] : [],
        trigger,
        messageId,
      },
    }),
  })
  const askChats: ConversationRuntime['askChats'] = [
    new Chat({
      id: `${chatId}:ask:0`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:1`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:2`,
      transport: transport(),
    }),
    new Chat({
      id: `${chatId}:ask:3`,
      transport: transport(),
    }),
  ]

  return {
    askChats,
    actChat: new Chat({
      id: `${chatId}:act`,
      transport: transport(),
      onFinish: ({ messages }) => {
        askChats[0].messages = [...messages]
      },
    }),
    hydrated: false,
    ui: createConversationUiState(uiOverrides),
  }
}
