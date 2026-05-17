'use client'

import React from 'react'
import {
  AtSign,
  Check,
  ChevronDown,
  FileText,
  ImageIcon,
  MessageSquare,
  Plus,
  Send,
  Video,
  X,
  Zap,
} from 'lucide-react'
import type { LiveGenerationMode, LiveTooltipRenderer } from './LiveModelPicker'

export interface LiveComposerAttachedImage {
  dataUrl: string
  name: string
}

export interface LiveComposerPendingDocument {
  clientId: string
  name: string
  status: 'uploading' | 'ready' | 'error'
  error?: string
}

function withTooltip(
  renderTooltip: LiveTooltipRenderer | undefined,
  label: string,
  side: 'top' | 'bottom',
  children: React.ReactNode,
) {
  return renderTooltip ? renderTooltip({ label, side, children }) : children
}

export function LiveAttachmentTray({
  attachedImages,
  pendingDocuments,
  onRemoveImage,
  onRemoveDocument,
}: {
  attachedImages: LiveComposerAttachedImage[]
  pendingDocuments: LiveComposerPendingDocument[]
  onRemoveImage: (index: number) => void
  onRemoveDocument: (clientId: string) => void
}) {
  if (attachedImages.length === 0 && pendingDocuments.length === 0) return null

  return (
    <div className="mb-2 flex min-w-0 flex-wrap gap-2">
      {attachedImages.map((image, index) => (
        <div key={`img-${index}`} className="relative group">
          <img
            src={image.dataUrl}
            alt={image.name}
            className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]"
          />
          <button
            type="button"
            onClick={() => onRemoveImage(index)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--foreground)] text-[var(--background)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={9} />
          </button>
        </div>
      ))}
      {pendingDocuments.map((doc) => (
        <div
          key={doc.clientId}
          className="relative group flex min-w-0 max-w-full items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-xs text-[var(--muted)] sm:max-w-[min(100%,220px)]"
        >
          <FileText size={14} className="shrink-0 text-[var(--muted)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[var(--foreground)]">{doc.name}</p>
            {doc.status === 'uploading' && (
              <p className="text-[10px] text-[var(--muted-light)] mt-0.5 animate-pulse">Indexing…</p>
            )}
            {doc.status === 'ready' && (
              <p className="text-[10px] text-emerald-600 mt-0.5">Indexed</p>
            )}
            {doc.status === 'error' && (
              <p className="text-[10px] text-red-500 mt-0.5 truncate" title={doc.error}>
                {doc.error ?? 'Failed'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemoveDocument(doc.clientId)}
            className="shrink-0 p-0.5 rounded hover:bg-[var(--surface-subtle)] text-[var(--muted-light)]"
            aria-label="Remove"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function LiveComposerToolbar({
  attachMenuRef,
  modeMenuRef,
  renderTooltip,
  attachMenuOpen,
  onToggleAttachMenu,
  supportsVision,
  onAttachImages,
  onGenerateImage,
  onGenerateVideo,
  onAttachDocuments,
  onOpenMentions,
  generationChip,
  onClearGenerationChip,
  mode,
  modeMenuOpen,
  onToggleModeMenu,
  onSelectChatMode,
  onSelectAutomateMode,
  isActiveLoading,
  onStop,
  onSend,
  sendDisabled,
}: {
  attachMenuRef?: React.Ref<HTMLDivElement>
  modeMenuRef?: React.Ref<HTMLDivElement>
  renderTooltip?: LiveTooltipRenderer
  attachMenuOpen: boolean
  onToggleAttachMenu: () => void
  supportsVision: boolean
  onAttachImages: () => void
  onGenerateImage: () => void
  onGenerateVideo: () => void
  onAttachDocuments: () => void
  onOpenMentions: () => void
  generationChip: Exclude<LiveGenerationMode, 'text'> | null
  onClearGenerationChip: () => void
  mode: 'chat' | 'automate'
  modeMenuOpen: boolean
  onToggleModeMenu: () => void
  onSelectChatMode: () => void
  onSelectAutomateMode: () => void
  isActiveLoading: boolean
  onStop: () => void
  onSend: () => void
  sendDisabled: boolean
}) {
  return (
    <div className="mt-2 flex min-h-9 items-center gap-2">
      <div ref={attachMenuRef} className="relative shrink-0">
        {withTooltip(
          renderTooltip,
          'Attach files or switch to image/video',
          'top',
          <button
            type="button"
            onClick={onToggleAttachMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>,
        )}
        {attachMenuOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-lg py-1 w-52 z-20">
            <button
              type="button"
              onClick={onAttachImages}
              disabled={!supportsVision}
              title={!supportsVision ? 'You need a vision model to attach images.' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors ${
                supportsVision
                  ? 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                  : 'text-[#bbb] cursor-not-allowed'
              }`}
            >
              <ImageIcon size={13} className="text-[var(--foreground)]" />
              <span>Attach Images</span>
            </button>
            <div className="border-t border-[var(--border)] my-1" />
            <button
              type="button"
              onClick={onGenerateImage}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <ImageIcon size={13} className="text-[var(--foreground)]" />
              <span>Generate Image</span>
            </button>
            <button
              type="button"
              onClick={onGenerateVideo}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Video size={13} className="text-[var(--foreground)]" />
              <span>Generate Video</span>
            </button>
            <div className="border-t border-[var(--border)] my-1" />
            <button
              type="button"
              onClick={onAttachDocuments}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <FileText size={13} />
              <span>Documents</span>
              <span className="ml-auto text-[10px] text-[var(--muted-light)]">PDF, Word, text</span>
            </button>
          </div>
        )}
      </div>
      {withTooltip(
        renderTooltip,
        'Reference files, skills, automations…',
        'top',
        <button
          type="button"
          onClick={onOpenMentions}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          aria-label="Insert mention"
        >
          <AtSign size={16} strokeWidth={1.75} />
        </button>,
      )}
      {generationChip && (
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--foreground)] px-2 py-1 text-xs font-medium text-[var(--background)]">
          {generationChip === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
          {generationChip === 'image' ? 'Image' : 'Video'}
          <button type="button" onClick={onClearGenerationChip} className="ml-0.5 hover:opacity-70">
            <X size={9} />
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-2">
        <div ref={modeMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleModeMenu}
            className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
              mode === 'automate'
                ? 'text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {mode === 'automate' ? (
              <Zap size={12} strokeWidth={1.75} />
            ) : (
              <MessageSquare size={12} strokeWidth={1.75} />
            )}
            <span>{mode === 'automate' ? 'Automate' : 'Chat'}</span>
            <ChevronDown size={10} className="opacity-60" />
          </button>
          {modeMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 z-20 w-40 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
              <button
                type="button"
                onClick={onSelectChatMode}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                  mode === 'chat' ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                }`}
              >
                <MessageSquare size={13} />
                <span>Chat</span>
                {mode === 'chat' && <Check size={11} className="ml-auto" />}
              </button>
              <button
                type="button"
                onClick={onSelectAutomateMode}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                  mode === 'automate' ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                }`}
              >
                <Zap size={13} strokeWidth={1.75} />
                <span>Automate</span>
                {mode === 'automate' && <Check size={11} className="ml-auto" />}
              </button>
            </div>
          )}
        </div>
        {isActiveLoading ? (
          withTooltip(
            renderTooltip,
            'Stop generating',
            'top',
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80"
            >
              <div className="h-3.5 w-3.5 rounded-sm bg-[var(--background)]" />
            </button>,
          )
        ) : (
          withTooltip(
            renderTooltip,
            'Send (↵) · new line (⇧↵)',
            'top',
            <button
              type="button"
              onClick={onSend}
              disabled={sendDisabled}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80 disabled:opacity-40"
            >
              <Send size={17} strokeWidth={1.75} />
            </button>,
          )
        )}
      </div>
    </div>
  )
}
