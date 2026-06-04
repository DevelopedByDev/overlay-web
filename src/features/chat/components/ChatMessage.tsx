'use client'

import type { UseChatHelpers } from '@/components/providers/ai-chat-client'
import type { ComponentProps } from 'react'
import type { UIMessage } from '@/shared/chat/ai-ui-message'
import { FREE_TIER_AUTO_MODEL_ID } from '@/shared/ai/gateway/model-types'
import {
  getChatModelDisplayName,
} from '@/shared/ai/gateway/model-data'
import type { SourceCitationMap } from '@/shared/knowledge/ask-knowledge-types'
import type { GeneratedUiData } from '@overlay/chat-core/generated-ui'
import type { GeneratedUiConnectorActions } from '@overlay/chat-react'
import { normalizeAgentAssistantText } from '@/shared/chat/agent-assistant-text'
import {
  assistantBlocksToPlainText,
  buildAssistantVisualSequence,
  errorLabel,
  getMessageImageAttachments,
  getMessageText,
  getRoutedModelId,
  getUserMessageDocNames,
  getUserReplyThreadMeta,
  getUserTurnId,
  resolveActAssistant,
  splitUserDisplayText,
} from './chat-interface/chatLogic'
import type { DraftModalState } from './chat-interface/types'
import { ChatToolSurface } from './ChatToolSurface'
import { ChatMediaMessage } from './ChatMediaMessage'

type ChatInstance = UseChatHelpers<UIMessage>

type CommonMessageProps = {
  message: UIMessage
  exchangeIndex: number
  exitingTurnIds: string[]
  onJumpToReply: (turnId: string) => void
  onDeleteTurn: (turnId: string) => void | Promise<void>
}

type TextChatMessageProps = CommonMessageProps & {
  kind: 'text'
  primaryMessages: UIMessage[]
  latestExchangeIndex: number
  actChat: ChatInstance
  chatInstances: ChatInstance[]
  exchangeModes: ('ask' | 'act')[]
  exchangeModels: string[][]
  selectedTabPerExchange: number[]
  selectedModels: string[]
  isActiveLoading: boolean
  isOptimisticLoading: boolean
  interruptedExchangeIdx: number | null
  sourcesPanel: { turnId: string } | null
  getResponseForExchangeForModel: (modelId: string, exchangeIndex: number, slotOrder?: string[]) => UIMessage | null
  onTabSelect: (exchangeIndex: number, tabIndex: number) => void
  onReplyToAssistantText: (assistantText: string, turnId: string | null) => void
  onBranch: (turnId: string | null) => void | Promise<void>
  onOpenDraft: (state: DraftModalState) => void
  onOpenSources: Parameters<typeof ChatToolSurface>[0]['onOpenSources']
  onRetry: (message: UIMessage, exchangeIndex: number, isActExchange: boolean, exchangeModels: string[]) => void | Promise<void>
  onOpenFilePreview: (name: string, fileIds: string[]) => void | Promise<void>
  onOpenAttachmentPreview: (preview: { name: string; content: string; url?: string }) => void
  onContinue: () => void
  onGeneratedUiChange: (messageId: string, partId: string, data: GeneratedUiData) => void
  generatedUiConnectorActions?: GeneratedUiConnectorActions
}

export type ChatMessageProps = ComponentProps<typeof ChatMediaMessage> | TextChatMessageProps

export function ChatMessage(props: ChatMessageProps) {
  if (props.kind === 'text') return <TextChatMessage {...props} />
  return <ChatMediaMessage {...props} />
}

function TextChatMessage(props: TextChatMessageProps) {
  const {
    message,
    exchangeIndex,
    primaryMessages,
    latestExchangeIndex,
    actChat,
    chatInstances,
    exchangeModes,
    exchangeModels,
    selectedTabPerExchange,
    selectedModels,
    isActiveLoading,
    isOptimisticLoading,
    interruptedExchangeIdx,
    exitingTurnIds,
    sourcesPanel,
  } = props
  const modelList = exchangeModels[exchangeIndex] ?? []
  const selectedTab = selectedTabPerExchange[exchangeIndex] ?? 0
  const selectedModelId = modelList[selectedTab] ?? selectedModels[0] ?? ''
  const isLatest = exchangeIndex === latestExchangeIndex
  const isActExchange = (exchangeModes[exchangeIndex] ?? 'ask') === 'act'
  const isMultiAct = isActExchange && modelList.length > 1
  const streamSlotIndex = !selectedModelId ? -1 : isMultiAct ? modelList.indexOf(selectedModelId) : isActExchange ? -1 : selectedModels.indexOf(selectedModelId)
  const slotInstance = streamSlotIndex >= 0 ? chatInstances[streamSlotIndex] : null
  let responseMsg = props.getResponseForExchangeForModel(selectedModelId, exchangeIndex, isMultiAct ? modelList : undefined)
  let responseText = responseMsg ? getMessageText(responseMsg) : ''

  if (isActExchange && !isMultiAct) {
    const paired = resolveActAssistant(primaryMessages, actChat.messages, message.id)
    responseMsg = paired ? (paired as UIMessage) : null
    responseText = paired ? getMessageText(paired) : ''
  }

  const multiActInstance = streamSlotIndex >= 0 ? chatInstances[streamSlotIndex] : null
  const persistedStatus = (responseMsg as { status?: 'generating' | 'completed' | 'error' } | null)?.status
  const activeHttpLoading = isLatest && (
    (isActExchange
      ? (isMultiAct
          ? (multiActInstance?.status === 'streaming' || multiActInstance?.status === 'submitted')
          : (actChat.status === 'streaming' || actChat.status === 'submitted'))
      : !!slotInstance && (slotInstance.status === 'streaming' || slotInstance.status === 'submitted')) ||
    isOptimisticLoading
  )
  const instLoading = activeHttpLoading || persistedStatus === 'generating'
  const persistedErrorText = persistedStatus === 'error' && responseText.trim()
    ? responseText.trim()
    : 'Generation failed'
  const instError = isLatest
    ? persistedStatus === 'error'
      ? new Error(persistedErrorText)
      : isActExchange
        ? isMultiAct && streamSlotIndex >= 0
          ? chatInstances[streamSlotIndex]?.error ?? null
          : isMultiAct ? null : actChat.error
        : slotInstance?.error ?? null
    : null
  const responseParts = responseMsg && Array.isArray((responseMsg as { parts?: unknown[] }).parts)
    ? (responseMsg as { parts: unknown[] }).parts
    : undefined
  const responseMessageId = responseMsg && typeof (responseMsg as { id?: unknown }).id === 'string'
    ? (responseMsg as { id: string }).id
    : null
  let assistantVisualBlocks = buildAssistantVisualSequence(responseParts)
  if (assistantVisualBlocks.length === 0 && responseText.trim()) {
    assistantVisualBlocks = [{ kind: 'text', text: normalizeAgentAssistantText(responseText) }]
  }
  const hasAssistantText = assistantVisualBlocks.some((block) => block.kind === 'text' && block.text.trim().length > 0)
  const hasAssistantActivity = assistantVisualBlocks.length > 0
  const isStreaming = (activeHttpLoading || persistedStatus === 'generating') && hasAssistantActivity
  const isTextStreaming = activeHttpLoading && hasAssistantText
  const rawUserText = getMessageText(message)
  const metaDocs = getUserMessageDocNames(message)
  const { bodyText, docNames: parsedDocNames } = splitUserDisplayText(rawUserText)
  const turnId = getUserTurnId(message)
  const isExiting = !!turnId && exitingTurnIds.includes(turnId)
  const assistantPlainForReply = assistantBlocksToPlainText(assistantVisualBlocks)
  const errLabelForTurn = errorLabel(instError)
  const interruptedHere = interruptedExchangeIdx === exchangeIndex && !errLabelForTurn
  const replyPlain = interruptedHere && assistantPlainForReply.trim()
    ? `${assistantPlainForReply}\n\nResponse was interrupted.`
    : interruptedHere ? 'Response was interrupted.' : assistantPlainForReply
  const routedModelId = responseMsg ? getRoutedModelId(responseMsg) : null
  const routedModelName = selectedModelId === FREE_TIER_AUTO_MODEL_ID && routedModelId ? getChatModelDisplayName(routedModelId) : null
  const modelLabelSingle = selectedModelId === FREE_TIER_AUTO_MODEL_ID && routedModelName ? `Free · ${routedModelName}` : getChatModelDisplayName(selectedModelId)

  return (
    <ChatToolSurface
      userMsgId={message.id}
      userBodyText={metaDocs.length > 0 ? rawUserText.trim() : bodyText}
      userDocumentNames={metaDocs.length > 0 ? metaDocs : parsedDocNames}
      userIndexedAttachments={(message as { metadata?: { indexedAttachments?: { name: string; fileIds: string[] }[] } }).metadata?.indexedAttachments ?? []}
      userImages={getMessageImageAttachments(message)}
      exchIdx={exchangeIndex}
      responseModelId={selectedModelId}
      assistantVisualBlocks={assistantVisualBlocks}
      isStreaming={isStreaming}
      isTextStreaming={isTextStreaming}
      errorMessage={errLabelForTurn}
      exchModelList={modelList}
      selectedTab={selectedTab}
      onTabSelect={(tabIndex) => props.onTabSelect(exchangeIndex, tabIndex)}
      isLoadingTabs={false}
      responseInProgress={instLoading}
      sourceCitations={(responseMsg as { metadata?: { sourceCitations?: SourceCitationMap } } | undefined)?.metadata?.sourceCitations}
      turnIdForActions={turnId}
      modelLabel={modelList.length > 1 ? `${modelLabelSingle} · ${modelList.length} models` : modelLabelSingle}
      onDeleteTurn={() => turnId && props.onDeleteTurn(turnId)}
      onReply={() => props.onReplyToAssistantText(replyPlain, turnId)}
      onBranch={() => props.onBranch(turnId)}
      interrupted={interruptedHere}
      actionsLocked={isLatest && isActiveLoading}
      isExiting={isExiting}
      replyThreadMeta={getUserReplyThreadMeta(message)}
      onJumpToReply={props.onJumpToReply}
      onOpenDraft={props.onOpenDraft}
      onOpenSources={props.onOpenSources}
      isSourcesOpenForThis={!!sourcesPanel && sourcesPanel.turnId === (turnId ?? message.id)}
      onRetry={() => props.onRetry(message, exchangeIndex, isActExchange, modelList)}
      retryDisabled={!turnId || isExiting || (isLatest && isActiveLoading) || instLoading}
      onOpenFilePreview={props.onOpenFilePreview}
      onOpenAttachmentPreview={props.onOpenAttachmentPreview}
      userMentions={(message as { metadata?: { mentions?: Array<{ type: string; id: string; name: string }> } }).metadata?.mentions}
      onContinue={(['[Request timed out after 300s. Continue?]', '[Interrupted by user. Continue?]'] as const).some((s) => assistantPlainForReply.includes(s)) ? props.onContinue : undefined}
      getModelDisplayName={getChatModelDisplayName}
      onGeneratedUiChange={responseMessageId ? (partId, data) => props.onGeneratedUiChange(responseMessageId, partId, data) : undefined}
      generatedUiConnectorActions={props.generatedUiConnectorActions}
    />
  )
}
