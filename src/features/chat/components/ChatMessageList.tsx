'use client'

import type { ReactNode, RefObject } from 'react'
import type { UseChatHelpers } from '@/components/providers/ai-chat-client'
import type { UIMessage } from '@/shared/chat/ai-ui-message'
import type { WebSourceItem } from '@/shared/web/web-sources'
import type { GeneratedUiData } from '@overlay/chat-core/generated-ui'
import type { GeneratedUiConnectorActions } from '@overlay/chat-react'
import type { DraftModalState, GenerationResult } from './chat-interface/types'
import { ChatMessage } from './ChatMessage'

type ChatInstance = UseChatHelpers<UIMessage>

export type ChatMessageListState = {
  primaryMessages: UIMessage[]
  latestExchangeIndex: number
  generationResults: Map<number, GenerationResult[]>
  exchangeGenTypes: ('text' | 'image' | 'video')[]
  exchangeModels: string[][]
  selectedImageModels: string[]
  selectedVideoModels: string[]
  selectedTabPerExchange: number[]
  selectedModels: string[]
  exchangeModes: ('ask' | 'act')[]
}

export type ChatMessageListRuntime = {
  actChat: ChatInstance
  chatInstances: ChatInstance[]
  isActiveLoading: boolean
  isOptimisticLoading: boolean
  interruptedExchangeIdx: number | null
  exitingTurnIds: string[]
  sourcesPanel: { turnId: string; sources: WebSourceItem[] } | null
  getResponseForExchangeForModel: (modelId: string, exchangeIndex: number, slotOrder?: string[]) => UIMessage | null
}

export type ChatMessageListActions = {
  onTabSelect: (exchangeIndex: number, tabIndex: number) => void
  onJumpToReply: (turnId: string) => void
  onDeleteTurn: (turnId: string) => void | Promise<void>
  onReplyToMediaPrompt: (prompt: string, kind: 'image' | 'video', turnId: string | null) => void
  onReplyToAssistantText: (assistantText: string, turnId: string | null) => void
  onBranch: (turnId: string | null) => void | Promise<void>
  onOpenDraft: (state: DraftModalState) => void
  onOpenSources: (turnId: string, sources: WebSourceItem[]) => void
  onRetry: (message: UIMessage, exchangeIndex: number, isActExchange: boolean, exchangeModels: string[]) => void | Promise<void>
  onOpenFilePreview: (name: string, fileIds: string[]) => void | Promise<void>
  onOpenAttachmentPreview: (preview: { name: string; content: string; url?: string }) => void
  onContinue: () => void
  onGeneratedUiChange: (messageId: string, partId: string, data: GeneratedUiData) => void
  generatedUiConnectorActions?: GeneratedUiConnectorActions
}

type ChatMessageListProps = {
  messagesScrollRef: RefObject<HTMLDivElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  showLoadingState: boolean
  state: ChatMessageListState
  runtime: ChatMessageListRuntime
  actions: ChatMessageListActions
}

export function ChatMessageList({
  messagesScrollRef,
  messagesEndRef,
  showLoadingState,
  state,
  runtime,
  actions,
}: ChatMessageListProps) {
  return (
    <div
      ref={messagesScrollRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4"
    >
      <div className="mx-auto flex min-h-full w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
        {showLoadingState ? (
          <ChatMessageListSkeleton />
        ) : (
          <ChatMessages
            state={state}
            runtime={runtime}
            actions={actions}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

function ChatMessages({
  state,
  runtime,
  actions,
}: Pick<ChatMessageListProps, 'state' | 'runtime' | 'actions'>) {
  const blocks: ReactNode[] = []
  let exchangeIndex = 0

  for (const message of state.primaryMessages) {
    if (message.role !== 'user') continue
    const currentExchangeIndex = exchangeIndex++
    const generationType = state.exchangeGenTypes[currentExchangeIndex]

    if (generationType === 'image' || generationType === 'video') {
      blocks.push(
        <ChatMessage
          key={message.id}
          kind={generationType}
          message={message}
          exchangeIndex={currentExchangeIndex}
          generationResults={state.generationResults.get(currentExchangeIndex)}
          exchangeModels={state.exchangeModels[currentExchangeIndex] ?? []}
          selectedImageModels={state.selectedImageModels}
          selectedVideoModels={state.selectedVideoModels}
          exitingTurnIds={runtime.exitingTurnIds}
          onJumpToReply={actions.onJumpToReply}
          onDeleteTurn={actions.onDeleteTurn}
          onReplyToMediaPrompt={actions.onReplyToMediaPrompt}
          onOpenAttachmentPreview={actions.onOpenAttachmentPreview}
        />,
      )
      continue
    }

    blocks.push(
      <ChatMessage
        key={message.id}
        kind="text"
        message={message}
        exchangeIndex={currentExchangeIndex}
        primaryMessages={state.primaryMessages}
        latestExchangeIndex={state.latestExchangeIndex}
        actChat={runtime.actChat}
        chatInstances={runtime.chatInstances}
        exchangeModes={state.exchangeModes}
        exchangeModels={state.exchangeModels}
        selectedTabPerExchange={state.selectedTabPerExchange}
        selectedModels={state.selectedModels}
        isActiveLoading={runtime.isActiveLoading}
        isOptimisticLoading={runtime.isOptimisticLoading}
        interruptedExchangeIdx={runtime.interruptedExchangeIdx}
        exitingTurnIds={runtime.exitingTurnIds}
        sourcesPanel={runtime.sourcesPanel}
        getResponseForExchangeForModel={runtime.getResponseForExchangeForModel}
        onTabSelect={actions.onTabSelect}
        onJumpToReply={actions.onJumpToReply}
        onDeleteTurn={actions.onDeleteTurn}
        onReplyToAssistantText={actions.onReplyToAssistantText}
        onBranch={actions.onBranch}
        onOpenDraft={actions.onOpenDraft}
        onOpenSources={(turnId: string, sources: WebSourceItem[]) => actions.onOpenSources(turnId, sources)}
        onRetry={actions.onRetry}
        onOpenFilePreview={actions.onOpenFilePreview}
        onOpenAttachmentPreview={actions.onOpenAttachmentPreview}
        onContinue={actions.onContinue}
        onGeneratedUiChange={actions.onGeneratedUiChange}
        generatedUiConnectorActions={actions.generatedUiConnectorActions}
      />,
    )
  }

  return blocks
}

function ChatMessageListSkeleton() {
  return (
    <div className="flex min-h-full flex-col justify-start pt-4 sm:pt-6">
      <div className="max-w-2xl space-y-4">
        <div className="tool-line-shimmer w-fit text-sm font-medium">Loading conversation</div>
        <div className="space-y-2.5">
          <div className="ui-skeleton-line h-3 w-[min(72%,34rem)]" />
          <div className="ui-skeleton-line h-3 w-[min(88%,42rem)]" />
          <div className="ui-skeleton-line h-3 w-[min(54%,26rem)]" />
        </div>
      </div>
    </div>
  )
}
