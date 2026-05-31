'use client'

import type { RefObject } from 'react'
import type { UseChatHelpers } from '@/components/providers/ai-chat-client'
import type { UIMessage } from '@/shared/chat/ai-ui-message'
import type { WebSourceItem } from '@/shared/web/web-sources'
import type { DraftModalState, GenerationResult } from './chat-interface/types'
import { ChatMessage } from './ChatMessage'

type ChatInstance = UseChatHelpers<UIMessage>

type ChatMessageListProps = {
  messagesScrollRef: RefObject<HTMLDivElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  showLoadingState: boolean
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
  actChat: ChatInstance
  chatInstances: ChatInstance[]
  isActiveLoading: boolean
  isOptimisticLoading: boolean
  interruptedExchangeIdx: number | null
  exitingTurnIds: string[]
  sourcesPanel: { turnId: string; sources: WebSourceItem[] } | null
  getResponseForExchangeForModel: (modelId: string, exchangeIndex: number, slotOrder?: string[]) => UIMessage | null
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
}

export function ChatMessageList({
  messagesScrollRef,
  messagesEndRef,
  showLoadingState,
  primaryMessages,
  latestExchangeIndex,
  generationResults,
  exchangeGenTypes,
  exchangeModels,
  selectedImageModels,
  selectedVideoModels,
  selectedTabPerExchange,
  selectedModels,
  exchangeModes,
  actChat,
  chatInstances,
  isActiveLoading,
  isOptimisticLoading,
  interruptedExchangeIdx,
  exitingTurnIds,
  sourcesPanel,
  getResponseForExchangeForModel,
  onTabSelect,
  onJumpToReply,
  onDeleteTurn,
  onReplyToMediaPrompt,
  onReplyToAssistantText,
  onBranch,
  onOpenDraft,
  onOpenSources,
  onRetry,
  onOpenFilePreview,
  onOpenAttachmentPreview,
  onContinue,
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
            primaryMessages={primaryMessages}
            latestExchangeIndex={latestExchangeIndex}
            generationResults={generationResults}
            exchangeGenTypes={exchangeGenTypes}
            exchangeModels={exchangeModels}
            selectedImageModels={selectedImageModels}
            selectedVideoModels={selectedVideoModels}
            selectedTabPerExchange={selectedTabPerExchange}
            selectedModels={selectedModels}
            exchangeModes={exchangeModes}
            actChat={actChat}
            chatInstances={chatInstances}
            isActiveLoading={isActiveLoading}
            isOptimisticLoading={isOptimisticLoading}
            interruptedExchangeIdx={interruptedExchangeIdx}
            exitingTurnIds={exitingTurnIds}
            sourcesPanel={sourcesPanel}
            getResponseForExchangeForModel={getResponseForExchangeForModel}
            onTabSelect={onTabSelect}
            onJumpToReply={onJumpToReply}
            onDeleteTurn={onDeleteTurn}
            onReplyToMediaPrompt={onReplyToMediaPrompt}
            onReplyToAssistantText={onReplyToAssistantText}
            onBranch={onBranch}
            onOpenDraft={onOpenDraft}
            onOpenSources={onOpenSources}
            onRetry={onRetry}
            onOpenFilePreview={onOpenFilePreview}
            onOpenAttachmentPreview={onOpenAttachmentPreview}
            onContinue={onContinue}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

function ChatMessages(props: Omit<ChatMessageListProps, 'messagesScrollRef' | 'messagesEndRef' | 'showLoadingState'>) {
  const blocks: React.ReactNode[] = []
  let exchangeIndex = 0

  for (const message of props.primaryMessages) {
    if (message.role !== 'user') continue
    const currentExchangeIndex = exchangeIndex++
    const generationType = props.exchangeGenTypes[currentExchangeIndex]

    if (generationType === 'image' || generationType === 'video') {
      blocks.push(
        <ChatMessage
          key={message.id}
          kind={generationType}
          message={message}
          exchangeIndex={currentExchangeIndex}
          generationResults={props.generationResults.get(currentExchangeIndex)}
          exchangeModels={props.exchangeModels[currentExchangeIndex] ?? []}
          selectedImageModels={props.selectedImageModels}
          selectedVideoModels={props.selectedVideoModels}
          exitingTurnIds={props.exitingTurnIds}
          onJumpToReply={props.onJumpToReply}
          onDeleteTurn={props.onDeleteTurn}
          onReplyToMediaPrompt={props.onReplyToMediaPrompt}
          onOpenAttachmentPreview={props.onOpenAttachmentPreview}
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
        primaryMessages={props.primaryMessages}
        latestExchangeIndex={props.latestExchangeIndex}
        actChat={props.actChat}
        chatInstances={props.chatInstances}
        exchangeModes={props.exchangeModes}
        exchangeModels={props.exchangeModels}
        selectedTabPerExchange={props.selectedTabPerExchange}
        selectedModels={props.selectedModels}
        isActiveLoading={props.isActiveLoading}
        isOptimisticLoading={props.isOptimisticLoading}
        interruptedExchangeIdx={props.interruptedExchangeIdx}
        exitingTurnIds={props.exitingTurnIds}
        sourcesPanel={props.sourcesPanel}
        getResponseForExchangeForModel={props.getResponseForExchangeForModel}
        onTabSelect={props.onTabSelect}
        onJumpToReply={props.onJumpToReply}
        onDeleteTurn={props.onDeleteTurn}
        onReplyToAssistantText={props.onReplyToAssistantText}
        onBranch={props.onBranch}
        onOpenDraft={props.onOpenDraft}
        onOpenSources={(turnId: string, sources: WebSourceItem[]) => props.onOpenSources(turnId, sources)}
        onRetry={props.onRetry}
          onOpenFilePreview={props.onOpenFilePreview}
          onOpenAttachmentPreview={props.onOpenAttachmentPreview}
          onContinue={props.onContinue}
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
