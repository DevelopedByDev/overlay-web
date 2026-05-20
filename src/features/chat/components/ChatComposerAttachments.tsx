'use client'

import Image from 'next/image'
import { AlertCircle, FileText, X } from 'lucide-react'
import type { ChatComposerProps } from './ChatComposer'

export function AttachmentPreviewTray({
  attachedImages,
  setAttachedImages,
  pendingChatDocuments,
  removePendingDocument,
}: Pick<ChatComposerProps, 'attachedImages' | 'setAttachedImages' | 'pendingChatDocuments' | 'removePendingDocument'>) {
  if (attachedImages.length === 0 && pendingChatDocuments.length === 0) return null
  return (
    <div className="mb-2 flex min-w-0 flex-wrap gap-2">
      {attachedImages.map((img, index) => (
        <div key={`img-${index}`} className="group relative">
          <Image src={img.dataUrl} alt={img.name} width={64} height={64} unoptimized className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
          <button
            onClick={() => setAttachedImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X size={9} />
          </button>
        </div>
      ))}
      {pendingChatDocuments.map((doc) => (
        <div key={doc.clientId} className="group relative flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs text-[var(--muted)] sm:max-w-[min(100%,220px)]">
          <FileText size={14} className="shrink-0 text-[var(--muted)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[var(--foreground)]">{doc.name}</p>
            {doc.status === 'uploading' && <p className="mt-0.5 animate-pulse text-[10px] text-[var(--muted-light)]">Indexing…</p>}
            {doc.status === 'ready' && <p className="mt-0.5 text-[10px] text-emerald-600">Indexed</p>}
            {doc.status === 'error' && <p className="mt-0.5 truncate text-[10px] text-red-500" title={doc.error}>{doc.error ?? 'Failed'}</p>}
          </div>
          <button type="button" onClick={() => removePendingDocument(doc.clientId)} className="shrink-0 rounded p-0.5 text-[var(--muted-light)] hover:bg-[var(--surface-subtle)]" aria-label="Remove">
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ComposerAlerts({
  attachmentError,
  composerNotice,
}: Pick<ChatComposerProps, 'attachmentError' | 'composerNotice'>) {
  const alert = attachmentError ?? composerNotice
  if (!alert) return null
  const error = Boolean(attachmentError)
  return (
    <div
      className="mb-2 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs"
      style={{
        background: error ? 'var(--chat-alert-error-bg)' : 'var(--chat-alert-warn-bg)',
        borderColor: error ? 'var(--chat-alert-error-border)' : 'var(--chat-alert-warn-border)',
        color: error ? 'var(--chat-alert-error-text)' : 'var(--chat-alert-warn-text)',
      }}
    >
      <AlertCircle size={13} className="shrink-0 opacity-80" />
      {alert}
    </div>
  )
}
