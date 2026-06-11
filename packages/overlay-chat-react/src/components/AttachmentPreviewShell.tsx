'use client'

import type { ReactNode } from 'react'
import { Maximize2, PanelRightOpen, X } from 'lucide-react'

export type AttachmentPreviewMode = 'panel' | 'dialog'

export type AttachmentPreview = {
  name: string
  content: string
  url?: string
  fileId?: string
}

type AttachmentViewerRenderProps = {
  preview: AttachmentPreview
  headerRight: ReactNode
}

function AttachmentPreviewHeaderActions({
  mode,
  onClose,
  onModeChange,
}: {
  mode: AttachmentPreviewMode
  onClose: () => void
  onModeChange: (mode: AttachmentPreviewMode) => void
}) {
  const nextMode = mode === 'panel' ? 'dialog' : 'panel'
  const label = mode === 'panel' ? 'Open as floating dialog' : 'Open in side panel'
  return (
    <>
      <button
        type="button"
        onClick={() => onModeChange(nextMode)}
        className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        aria-label={label}
        title={label}
      >
        {mode === 'panel' ? <Maximize2 size={15} strokeWidth={1.75} /> : <PanelRightOpen size={15} strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        aria-label="Close attachment preview"
        title="Close"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </>
  )
}

export function AttachmentPreviewPanel({
  preview,
  mode,
  onClose,
  onModeChange,
  renderViewer,
}: {
  preview: AttachmentPreview
  mode: AttachmentPreviewMode
  onClose: () => void
  onModeChange: (mode: AttachmentPreviewMode) => void
  renderViewer: (props: AttachmentViewerRenderProps) => ReactNode
}) {
  const headerRight = (
    <AttachmentPreviewHeaderActions
      mode={mode}
      onClose={onClose}
      onModeChange={onModeChange}
    />
  )
  return <>{renderViewer({ preview, headerRight })}</>
}

export function AttachmentPreviewDialog({
  preview,
  onClose,
  onModeChange,
  renderViewer,
}: {
  preview: AttachmentPreview
  onClose: () => void
  onModeChange: (mode: AttachmentPreviewMode) => void
  renderViewer: (props: AttachmentViewerRenderProps) => ReactNode
}) {
  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-label="Attachment preview"
        className="overlay-dialog-in flex max-h-[min(92vh,900px)] min-h-[min(70vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {renderViewer({
          preview,
          headerRight: (
            <AttachmentPreviewHeaderActions
              mode="dialog"
              onClose={onClose}
              onModeChange={onModeChange}
            />
          ),
        })}
      </div>
    </div>
  )
}
