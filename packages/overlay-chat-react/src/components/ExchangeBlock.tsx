import { useMemo } from 'react'
import { AlertCircle, BookOpen, FileText, GitBranch, Play, Reply, RotateCw, Trash2 } from 'lucide-react'
import type { AssistantVisualBlock, DraftModalState, ToolVisualBlock } from '@overlay/chat-core'
import {
  assistantBlocksToPlainText,
  buildAssistantVisualSegments,
  collectWebSourcesFromBlocks,
  computeToolChainFlags,
  getDraftFromToolBlock,
  isOverlayGatedToolOutput,
} from '@overlay/chat-core'
import type { SourceCitationMap } from '../lib/source-citations'
import type { WebSourceItem } from '../lib/web-sources'
import { MarkdownMessage } from './MarkdownMessage'
import { FlashCopyIconButton } from './DraftReviewModal'
import {
  BrowserToolBlock,
  DraftSuggestionCard,
  GatedPaidFeatureCallout,
  MemoryToolBlock,
  ReasoningBlock,
  SingleToolCallRow,
  ToolCallsCollapsedGroup,
  WebSearchToolBlock,
  renderInlineMentions,
} from './exchange'

export interface ExchangeBlockProps {
  userMsgId: string
  userBodyText: string
  userDocumentNames: string[]
  userIndexedAttachments?: { name: string; fileIds: string[] }[]
  userImages: string[]
  exchIdx: number
  /** Model id for this tab — stable key for markdown remount when picker slots change */
  responseModelId: string
  /** Ordered tools, text, and file parts as they appear in the assistant message */
  assistantVisualBlocks: AssistantVisualBlock[]
  isStreaming: boolean
  isTextStreaming: boolean
  errorMessage: string | null
  exchModelList: string[]
  selectedTab: number
  onTabSelect: (tabIdx: number) => void
  isLoadingTabs: boolean
  responseInProgress: boolean
  sourceCitations?: SourceCitationMap
  turnIdForActions: string | null
  modelLabel: string
  onDeleteTurn: () => void
  onReply: () => void
  onBranch: () => void
  /** User stopped streaming for this exchange; show notice + footer actions. */
  interrupted?: boolean
  actionsLocked: boolean
  isExiting?: boolean
  replyThreadMeta: { replyToTurnId: string; replySnippet: string } | null
  onJumpToReply: (turnId: string) => void
  onOpenDraft: (state: DraftModalState) => void
  /** Open the shared sources sidebar with these web sources (lifted to ChatInterface). */
  onOpenSources: (turnId: string, sources: WebSourceItem[]) => void
  /** Whether the shared sidebar is currently showing this exchange's sources. */
  isSourcesOpenForThis: boolean
  onRetry?: () => void
  retryDisabled?: boolean
  onOpenFilePreview?: (name: string, fileIds: string[]) => void
  userMentions?: Array<{ type: string; id: string; name: string }>
  onContinue?: () => void
  getModelDisplayName: (modelId: string) => string
}

export function ExchangeBlock({
  userMsgId, userBodyText, userDocumentNames, userIndexedAttachments, userImages, exchIdx, responseModelId, assistantVisualBlocks, isStreaming, isTextStreaming, errorMessage,
  exchModelList, selectedTab, onTabSelect, isLoadingTabs, responseInProgress, sourceCitations,
  turnIdForActions, modelLabel, onDeleteTurn, onReply, onBranch, interrupted = false, actionsLocked, isExiting = false, replyThreadMeta, onJumpToReply,
  onOpenDraft, onOpenSources, isSourcesOpenForThis, onRetry, retryDisabled = true, onOpenFilePreview, userMentions, onContinue, getModelDisplayName,
}: ExchangeBlockProps) {
    const showTextBubble = userBodyText.length > 0
    const assistantPlainText = assistantBlocksToPlainText(assistantVisualBlocks)
    const lastTextBlockIndex = (() => {
      let idx = -1
      for (let i = 0; i < assistantVisualBlocks.length; i++) {
        if (assistantVisualBlocks[i]!.kind === 'text') idx = i
      }
      return idx
    })()
    const assistantSegments = useMemo(
      () => buildAssistantVisualSegments(assistantVisualBlocks),
      [assistantVisualBlocks],
    )
    const toolChainFlags = useMemo(() => computeToolChainFlags(assistantSegments), [assistantSegments])
    const webSources = useMemo(() => collectWebSourcesFromBlocks(assistantVisualBlocks), [assistantVisualBlocks])
    const responseSettled = !responseInProgress
    const copyPlainText =
      interrupted && !errorMessage
        ? assistantPlainText.trim()
          ? `${assistantPlainText}\n\nResponse was interrupted.`
          : 'Response was interrupted.'
        : assistantPlainText
    const showFooter =
      responseSettled && (assistantPlainText.length > 0 || !!errorMessage || interrupted)
    return (
      <div
        className={`relative flex flex-col gap-2 message-appear transition-all duration-300 ease-out ${
          isExiting ? 'pointer-events-none opacity-0 -translate-y-1' : 'translate-y-0 opacity-100'
        }`}
        data-exchange-idx={exchIdx}
        data-exchange-turn={turnIdForActions ?? undefined}
      >
        {/* User message */}
        <div className="flex min-w-0 justify-end">
          <div className="flex min-w-0 max-w-[min(92%,36rem)] flex-col items-end gap-2 sm:max-w-[75%]">
            {replyThreadMeta && (
              <button
                type="button"
                onClick={() => onJumpToReply(replyThreadMeta.replyToTurnId)}
                className="mb-1 max-w-full rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              >
                <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                  <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
                  Replying to
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[var(--muted)]">{replyThreadMeta.replySnippet}</span>
              </button>
            )}
            {userImages.length > 0 && (
              <div className="flex w-full flex-wrap justify-end gap-1.5">
                {userImages.map((src, i) => (
                  <img key={i} src={src} alt="attached"
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover" />
                ))}
              </div>
            )}
            {userDocumentNames.length > 0 && (
              <div className="flex w-full flex-wrap justify-end gap-1.5">
                {userDocumentNames.map((name) => {
                  const attachment = userIndexedAttachments?.find((a) => a.name === name)
                  const clickable = !!attachment && attachment.fileIds.length > 0 && !!onOpenFilePreview
                  return (
                    <div
                      key={name}
                      className={`flex max-w-[220px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--muted)] shadow-sm ${clickable ? 'cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors' : ''}`}
                      onClick={() => {
                        if (clickable) onOpenFilePreview!(name, attachment.fileIds)
                      }}
                      title={clickable ? 'Click to preview' : undefined}
                    >
                      <FileText size={13} className="shrink-0 text-[var(--muted)]" />
                      <span className="truncate font-medium text-[var(--foreground)]">{name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {showTextBubble && (
              <div className="chat-user-bubble ml-auto min-w-0 max-w-full break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:px-4">
                <span className="whitespace-pre-wrap">{renderInlineMentions(userBodyText, userMentions)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Inline model tabs — only shown when multiple models are active for this exchange */}
        {exchModelList.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {exchModelList.map((mId, tabIdx) => {
              const mName = getModelDisplayName(mId)
              const isActive = tabIdx === selectedTab
              return (
                <button
                  key={mId}
                  onClick={() => !isLoadingTabs && onTabSelect(tabIdx)}
                  disabled={isLoadingTabs}
                  className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                    isLoadingTabs ? 'cursor-not-allowed opacity-60' : ''
                  } ${
                    isActive ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--surface-subtle)] text-[var(--muted)] hover:bg-[var(--border)]'
                  }`}
                >
                  {mName}
                </button>
              )
            })}
          </div>
        )}

        {assistantSegments.map((seg, segIdx) => {
          const chain = toolChainFlags[segIdx]!
          if (seg.kind === 'reasoning') {
            // Actively streaming = still emitting reasoning deltas (or message-level stream and
            // this part has not been explicitly marked `done`). Everything else collapses.
            const active =
              (isStreaming && seg.block.state === 'streaming') ||
              (isStreaming && seg.block.state !== 'done' && seg.originIndex === assistantVisualBlocks.length - 1)
            return (
              <ReasoningBlock
                key={`${exchIdx}-seq-r-${seg.originIndex}-${seg.block.key}`}
                text={seg.block.text}
                streaming={active}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
            )
          }
          if (seg.kind === 'browser') {
            return (
              <BrowserToolBlock
                key={`${exchIdx}-seq-${seg.originIndex}-${seg.block.key}`}
                block={seg.block}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
            )
          }
          if (seg.kind === 'tools') {
            const onlyTools = seg.items.every((it): it is ToolVisualBlock => it.kind === 'tool')
            if (onlyTools && seg.items.length === 1) {
              const t = seg.items[0] as ToolVisualBlock
              const draft = getDraftFromToolBlock(t)
              if (draft) {
                const isAutomationDraft = draft.kind === 'automation'
                return (
                  <DraftSuggestionCard
                    key={`${exchIdx}-draft-${seg.originIndex}-${t.key}`}
                    title={draft.draft.name}
                    description={draft.draft.description}
                    badge={isAutomationDraft ? 'Automation Draft' : 'Skill Draft'}
                    reason={draft.draft.reason}
                    primaryLabel="Review draft"
                    secondaryLabel={isAutomationDraft ? 'Create automation' : 'Save skill'}
                    onPrimary={() => onOpenDraft(draft)}
                    onSecondary={() => onOpenDraft(draft)}
                  />
                )
              }
              if (isOverlayGatedToolOutput(t.toolOutput)) {
                return (
                  <GatedPaidFeatureCallout
                    key={`${exchIdx}-gated-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
                  />
                )
              }
              if (t.name === 'perplexity_search' || t.name === 'parallel_search') {
                return (
                  <WebSearchToolBlock
                    key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
                  />
                )
              }
              if (t.name === 'save_memory' || t.name === 'save_memory_batch' || t.name === 'update_memory') {
                return (
                  <MemoryToolBlock
                    key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                    block={t}
                    connectTop={chain.chainTop}
                    connectBottom={chain.chainBottom}
                  />
                )
              }
              return (
                <SingleToolCallRow
                  key={`${exchIdx}-seq-${seg.originIndex}-${t.key}`}
                  block={t}
                  connectTop={chain.chainTop}
                  connectBottom={chain.chainBottom}
                />
              )
            }
            return (
              <ToolCallsCollapsedGroup
                key={`${exchIdx}-seq-tools-${seg.originIndex}`}
                items={seg.items}
                connectTop={chain.chainTop}
                connectBottom={chain.chainBottom}
              />
            )
          }
          if (seg.kind === 'file') {
            const block = seg.block
            const isImg = (block.mediaType?.startsWith('image/') ?? true)
            const isVideo = block.mediaType?.startsWith('video/') ?? false
            if (!isImg && !isVideo) return null
            return (
              <div key={`${exchIdx}-seq-${seg.originIndex}-file`} className="w-full px-1 py-1">
                {isImg ? (
                  <img
                    src={block.url}
                    alt="Generated"
                    className="max-w-full max-h-[320px] rounded-xl border border-[var(--border)] object-contain"
                  />
                ) : (
                  <video
                    src={block.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="max-w-full max-h-[320px] rounded-xl border border-[var(--border)] object-contain"
                  />
                )}
              </div>
            )
          }
          const block = seg.block
          const isLastText = seg.originIndex === lastTextBlockIndex
          return (
            <div
              key={`${exchIdx}-seq-${seg.originIndex}-text`}
              className="w-full px-1 py-1 text-sm leading-relaxed text-[var(--foreground)]"
            >
              <MarkdownMessage
                key={`md-${userMsgId}-${responseModelId}-${seg.originIndex}`}
                text={block.text}
                isStreaming={isTextStreaming && isLastText}
                sourceCitations={isLastText ? sourceCitations : undefined}
                webSources={isLastText && webSources.length > 0 ? webSources : undefined}
                suppressTypingIndicator
              />
            </div>
          )
        })}

        {responseInProgress && assistantVisualBlocks.length === 0 && (
          <div className="flex items-center px-1 py-2 min-h-7" aria-live="polite" aria-busy="true">
            <span
              className="overlay-stream-marker overlay-stream-marker--standalone"
              aria-label="Response loading"
              role="img"
            />
          </div>
        )}

        {responseInProgress && assistantVisualBlocks.length > 0 && !errorMessage ? (
          <div className="flex items-center px-1 py-1 min-h-5" aria-live="polite" aria-busy="true">
            <span
              className="overlay-stream-marker overlay-stream-marker--standalone scale-75 opacity-80"
              aria-label="Response still generating"
              role="img"
            />
          </div>
        ) : null}

        {errorMessage && !responseInProgress && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
              style={{
                background: 'var(--chat-alert-error-bg)',
                borderColor: 'var(--chat-alert-error-border)',
                color: 'var(--chat-alert-error-text)',
              }}
            >
              <AlertCircle size={12} />
              {errorMessage}
            </div>
          </div>
        )}

        {interrupted && responseSettled && !errorMessage && (
          <div className="flex justify-start px-1 py-1">
            <p className="text-sm text-[var(--muted)]">Response was interrupted.</p>
          </div>
        )}

        {onContinue && responseSettled && !errorMessage && (
          <div className="flex justify-start px-1 py-1">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
            >
              <Play size={13} strokeWidth={1.75} />
              Continue
            </button>
          </div>
        )}

        {showFooter && (
          <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
            <FlashCopyIconButton
              copyText={copyPlainText}
              disabled={copyPlainText.length === 0 || isExiting}
              ariaLabel="Copy response"
            />
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retryDisabled}
                className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Regenerate response"
                title="Regenerate response"
              >
                <RotateCw size={14} strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={onDeleteTurn}
              disabled={!turnIdForActions || actionsLocked || isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Delete this turn from history"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onReply}
              disabled={isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Reply"
            >
              <Reply size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onBranch}
              disabled={!turnIdForActions || actionsLocked || isExiting}
              className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Branch chat from here"
              title="Branch chat from here"
            >
              <GitBranch size={14} strokeWidth={1.75} />
            </button>
            {webSources.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenSources(turnIdForActions ?? userMsgId, webSources)}
                disabled={isExiting}
                className={`ml-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${
                  isSourcesOpenForThis
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)]'
                }`}
                aria-label="Open sources"
                aria-pressed={isSourcesOpenForThis}
              >
                <BookOpen size={14} strokeWidth={1.75} className="shrink-0" />
                <span className="text-[11px] font-medium">Sources</span>
              </button>
            ) : null}
            <span className="ml-2 min-w-0 text-left text-[11px] text-[var(--muted-light)]">{modelLabel}</span>
          </div>
        )}

      </div>
    )
}
