import type { UIMessage } from '@/shared/chat/ai-ui-message'
import type { ConversationRuntime } from '../chat-interface/types'
import { getUserTurnId } from '@overlay/chat-core'

export function shouldResumeChatStreamIntoAskSlot({
  runtime,
  turnId,
  variantIndex,
  activeVariantCount,
}: {
  runtime: ConversationRuntime
  turnId: string
  variantIndex: number
  activeVariantCount: number
}): boolean {
  if (variantIndex > 0 || activeVariantCount > 1) return true

  const userTurns = (runtime.askChats[0].messages as UIMessage[])
    .filter((message) => message.role === 'user')
  const exchangeIndex = userTurns.findIndex((message) => getUserTurnId(message) === turnId)
  if (exchangeIndex < 0) return false

  return (runtime.ui.exchangeModels[exchangeIndex]?.length ?? 0) > 1
}
