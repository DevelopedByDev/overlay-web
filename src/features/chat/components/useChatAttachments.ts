'use client'

import { useRef, useState, type ClipboardEvent } from 'react'
import {
  LARGE_PASTE_MAX_BYTES,
  pastedTextFileName,
  shouldAttachPastedTextAsFile,
} from '@overlay/chat-core'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import { SUPPORTED_INPUT_IMAGE_TYPES } from './chat-interface/constants'
import type { AttachedImage, PendingChatDocument } from './chat-interface/types'

const IMAGE_EXTENSION_MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function supportedImageMimeType(file: File): string | null {
  if (SUPPORTED_INPUT_IMAGE_TYPES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSION_MIME_TYPES[ext] ?? null
}

export function useChatAttachments({
  embedProjectId,
  setComposerNotice,
}: {
  embedProjectId?: string | null
  setComposerNotice: (notice: string | null) => void
}) {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [pendingChatDocuments, setPendingChatDocuments] = useState<PendingChatDocument[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  function removePendingDocument(clientId: string) {
    setPendingChatDocuments((prev) => prev.filter((d) => d.clientId !== clientId))
  }

  function queueDocumentUpload(file: File) {
    const clientId = crypto.randomUUID()
    setAttachmentError(null)
    setPendingChatDocuments((prev) => [
      ...prev,
      { clientId, name: file.name, fileIds: [], status: 'uploading' },
    ])
    const form = new FormData()
    form.append('file', file)
    if (embedProjectId) form.append('projectId', embedProjectId)
    void overlayAppClient.files.ingestDocumentResponse(form, {
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          setPendingChatDocuments((prev) =>
            prev.map((d) =>
              d.clientId === clientId
                ? { ...d, status: 'error' as const, error: err.error ?? 'Could not index file' }
                : d,
            ),
          )
          return
        }
        const data = (await res.json().catch(() => ({}))) as {
          ids?: string[]
          name?: string
        }
        const fileIds = Array.isArray(data.ids) ? data.ids.map((id) => String(id)) : []
        const resolvedName =
          typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : file.name
        setPendingChatDocuments((prev) =>
          prev.map((d) =>
            d.clientId === clientId
              ? { ...d, status: 'ready' as const, fileIds, name: resolvedName }
              : d,
          ),
        )
      })
      .catch(() => {
        setPendingChatDocuments((prev) =>
          prev.map((d) =>
            d.clientId === clientId
              ? { ...d, status: 'error' as const, error: 'Network error' }
              : d,
          ),
        )
      })
  }

  function addDocumentsFromPicker(files: FileList | File[] | null) {
    if (!files?.length) return
    Array.from(files).forEach((file) => queueDocumentUpload(file))
  }

  function addImages(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      const mimeType = supportedImageMimeType(file)
      if (!mimeType) {
        if (!file.type.startsWith('image/')) return
        setAttachmentError(`Unsupported image format: ${file.name}. Use JPEG, PNG, GIF, or WebP.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setAttachmentError(null)
        setAttachedImages((prev) => [...prev, { dataUrl, mimeType, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  function handlePaste(e: ClipboardEvent) {
    const pastedText = e.clipboardData.getData('text/plain')
    if (pastedText && shouldAttachPastedTextAsFile(pastedText)) {
      e.preventDefault()
      const blob = new Blob([pastedText], { type: 'text/plain;charset=utf-8' })
      if (blob.size > LARGE_PASTE_MAX_BYTES) {
        setAttachmentError('Pasted text is too large to attach here. Upload it as a smaller text file.')
        return
      }
      const fileName = pastedTextFileName(pastedText)
      const file = new File([blob], fileName, { type: 'text/plain' })
      queueDocumentUpload(file)
      setComposerNotice(`Large paste attached as ${fileName}.`)
      window.setTimeout(() => setComposerNotice(null), 5000)
      return
    }

    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f != null)
    if (imageFiles.length > 0) {
      e.preventDefault()
      addImages(imageFiles)
    }
  }

  function clearAttachments() {
    setAttachedImages([])
    setPendingChatDocuments([])
    setAttachmentError(null)
  }

  return {
    attachedImages,
    setAttachedImages,
    pendingChatDocuments,
    setPendingChatDocuments,
    attachmentError,
    setAttachmentError,
    fileInputRef,
    docInputRef,
    dragCounterRef,
    removePendingDocument,
    queueDocumentUpload,
    addDocumentsFromPicker,
    addImages,
    handlePaste,
    clearAttachments,
  }
}
