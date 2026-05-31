'use client'

import { useCallback, useState } from 'react'
import type { WebSourceItem } from '@/shared/web/web-sources'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

export type AttachmentPreviewMode = 'panel' | 'dialog'

export type AttachmentPreview = {
  name: string
  content: string
  url?: string
  fileId?: string
}

const ATTACHMENT_PREVIEW_MODE_KEY = 'overlay_attachment_preview_mode'

function readStoredAttachmentPreviewMode(): AttachmentPreviewMode {
  if (typeof window === 'undefined') return 'panel'
  try {
    const saved = window.localStorage.getItem(ATTACHMENT_PREVIEW_MODE_KEY)
    return saved === 'dialog' ? 'dialog' : 'panel'
  } catch {
    return 'panel'
  }
}

export function useChatPanels() {
  const [sourcesPanel, setSourcesPanel] = useState<{ turnId: string; sources: WebSourceItem[] } | null>(null)
  const openSourcesPanel = useCallback((turnId: string, sources: WebSourceItem[]) => {
    setSourcesPanel((prev) => (prev && prev.turnId === turnId ? null : { turnId, sources }))
  }, [])
  const closeSourcesPanel = useCallback(() => setSourcesPanel(null), [])

  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null)
  const [attachmentPreviewMode, setAttachmentPreviewModeState] = useState<AttachmentPreviewMode>(readStoredAttachmentPreviewMode)

  const setAttachmentPreviewMode = useCallback((mode: AttachmentPreviewMode) => {
    setAttachmentPreviewModeState(mode)
    try {
      window.localStorage.setItem(ATTACHMENT_PREVIEW_MODE_KEY, mode)
    } catch {
      // Ignore blocked storage; the current session still reflects the preference.
    }
  }, [])

  const openAttachmentPreview = useCallback((preview: AttachmentPreview) => {
    setSourcesPanel(null)
    setAttachmentPreview(preview)
  }, [])

  const openFilePreview = useCallback(async (name: string, fileIds: string[]) => {
    const fileId = fileIds[0]
    if (!fileId) return
    setSourcesPanel(null)
    setAttachmentPreview({
      name,
      fileId,
      content: '',
      url: `/api/v1/files/${fileId}/content`,
    })
    try {
      const res = await overlayAppClient.files.contentResponse(fileId)
      if (res.ok) {
        const content = await res.text()
        setAttachmentPreview((prev) => (
          prev?.fileId === fileId ? { ...prev, content } : prev
        ))
      } else {
        setAttachmentPreview((prev) => (
          prev?.fileId === fileId ? { ...prev, content: '' } : prev
        ))
      }
    } catch {
      setAttachmentPreview((prev) => (
        prev?.fileId === fileId ? { ...prev, content: '' } : prev
      ))
    }
  }, [])

  const closeAttachmentPreview = useCallback(() => {
    setAttachmentPreview(null)
  }, [])

  return {
    attachmentPreview,
    attachmentPreviewMode,
    closeAttachmentPreview,
    closeSourcesPanel,
    openAttachmentPreview,
    openFilePreview,
    openSourcesPanel,
    setAttachmentPreviewMode,
    setSourcesPanel,
    sourcesPanel,
  }
}
