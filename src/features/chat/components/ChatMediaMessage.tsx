'use client'

import Image from 'next/image'
import { Reply, Trash2 } from 'lucide-react'
import { MediaSlotOutput, UserMessageBubble } from '@overlay/chat-react'
import type { UIMessage } from '@/shared/chat/ai-ui-message'
import { DEFAULT_IMAGE_MODEL_ID, DEFAULT_VIDEO_MODEL_ID } from '@/shared/ai/gateway/model-types'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/shared/ai/gateway/model-data'
import { getMessageImageAttachments, getMessageText, getUserReplyThreadMeta, getUserTurnId } from '@overlay/chat-core'
import type { GenerationResult } from './chat-interface/types'
import { FlashCopyIconButton } from './chat-interface/Modals'

export type ChatMediaMessageProps = {
  message: UIMessage
  exchangeIndex: number
  kind: 'image' | 'video'
  generationResults?: GenerationResult[]
  exchangeModels: string[]
  selectedImageModels: string[]
  selectedVideoModels: string[]
  exitingTurnIds: string[]
  onJumpToReply: (turnId: string) => void
  onDeleteTurn: (turnId: string) => void | Promise<void>
  onReplyToMediaPrompt: (prompt: string, kind: 'image' | 'video', turnId: string | null) => void
  onOpenAttachmentPreview: (preview: { name: string; content: string; url?: string }) => void
}

export function ChatMediaMessage({
  message,
  exchangeIndex,
  kind,
  generationResults,
  exchangeModels,
  selectedImageModels,
  selectedVideoModels,
  exitingTurnIds,
  onJumpToReply,
  onDeleteTurn,
  onReplyToMediaPrompt,
  onOpenAttachmentPreview,
}: ChatMediaMessageProps) {
  let modelList = exchangeModels
  if (modelList.length === 0) {
    modelList = kind === 'image'
      ? [selectedImageModels[0] ?? DEFAULT_IMAGE_MODEL_ID]
      : [selectedVideoModels[0] ?? DEFAULT_VIDEO_MODEL_ID]
  }
  let results = generationResults?.length
    ? [...generationResults]
    : modelList.map(() => ({ type: kind, status: 'generating' as const }))
  while (results.length < modelList.length) results.push({ type: kind, status: 'generating' })
  if (results.length > modelList.length) results = results.slice(0, modelList.length)

  const isMulti = modelList.length > 1
  const promptText = getMessageText(message)
  const turnId = getUserTurnId(message)
  const replyMeta = getUserReplyThreadMeta(message)
  const isExiting = !!turnId && exitingTurnIds.includes(turnId)
  const stillGenerating = results.some((result) => !result || result.status === 'generating')
  const modelLabel = modelList.length > 1
    ? `${kind === 'image' ? 'Image' : 'Video'} · ${modelList.length} models`
    : IMAGE_MODELS.find((m) => m.id === modelList[0])?.name ||
      VIDEO_MODELS.find((m) => m.id === modelList[0])?.name ||
      modelList[0] ||
      kind

  return (
    <div
      className={`flex flex-col gap-3 message-appear transition-all duration-300 ease-out ${
        isExiting ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
      data-exchange-idx={exchangeIndex}
      data-exchange-turn={turnId ?? undefined}
    >
      {replyMeta && (
        <ReplyAnchor snippet={replyMeta.replySnippet} onClick={() => onJumpToReply(replyMeta.replyToTurnId)} />
      )}
      <UserPromptBubble message={message} text={promptText} onOpenAttachmentPreview={onOpenAttachmentPreview} />
      <div
        className={`min-w-0 w-full ${isMulti ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'flex flex-col gap-1.5 items-start'} ${
          stillGenerating && !isMulti ? (kind === 'video' ? 'min-h-40' : 'min-h-52') : ''
        }`}
      >
        {modelList.map((modelId, index) => {
          const modelName =
            IMAGE_MODELS.find((m) => m.id === modelId)?.name ||
            VIDEO_MODELS.find((m) => m.id === modelId)?.name ||
            modelId
          return (
            <div key={`${modelId}-${index}`} className={`min-w-0 ${isMulti ? 'w-full' : 'flex flex-col gap-1.5 self-start'}`}>
              <MediaSlotOutput genType={kind} isMulti={isMulti} modelName={modelName} result={results[index]} />
            </div>
          )
        })}
      </div>
      {!stillGenerating && (
        <div className="message-appear flex items-center gap-1 px-1 pt-0.5">
          <FlashCopyIconButton copyText={promptText} disabled={!promptText || isExiting} ariaLabel="Copy prompt" />
          <IconAction label="Delete this turn from history" disabled={!turnId || isExiting} onClick={() => turnId && onDeleteTurn(turnId)}>
            <Trash2 size={14} strokeWidth={1.75} />
          </IconAction>
          <IconAction label="Reply" disabled={isExiting} onClick={() => onReplyToMediaPrompt(promptText, kind, turnId)}>
            <Reply size={14} strokeWidth={1.75} />
          </IconAction>
          <span className="ml-2 shrink-0 text-left text-[11px] text-[var(--muted-light)]">{modelLabel}</span>
        </div>
      )}
    </div>
  )
}

function ReplyAnchor({ snippet, onClick }: { snippet: string; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="max-w-[75%] rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
      >
        <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
          <Reply size={12} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
          Replying to
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[var(--muted)]">{snippet}</span>
      </button>
    </div>
  )
}

function UserPromptBubble({
  message,
  text,
  onOpenAttachmentPreview,
}: {
  message: UIMessage
  text: string
  onOpenAttachmentPreview: ChatMediaMessageProps['onOpenAttachmentPreview']
}) {
  const images = getMessageImageAttachments(message)
  return (
    <div className="flex justify-end">
      <UserMessageBubble className="max-w-[min(92%,36rem)] sm:max-w-[75%]">
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {images.map((image, imgIdx) => (
              <button
                key={`${image.url}-${imgIdx}`}
                type="button"
                onClick={() => onOpenAttachmentPreview({
                  name: image.name,
                  content: image.url,
                  url: image.url,
                })}
                className="rounded-lg outline-none transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-subtle)]"
                title="Open attachment"
              >
                <Image src={image.url} alt={image.name} width={144} height={144} unoptimized className="h-auto max-h-36 w-auto rounded-lg object-cover" />
              </button>
            ))}
          </div>
        )}
        {text}
      </UserMessageBubble>
    </div>
  )
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-[var(--muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 active:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-30"
      aria-label={label}
    >
      {children}
    </button>
  )
}
