'use client'

import { useCallback, useState } from 'react'
import type { WebSourceItem } from '@/shared/web/web-sources'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

export function useChatPanels() {
  const [sourcesPanel, setSourcesPanel] = useState<{ turnId: string; sources: WebSourceItem[] } | null>(null)
  const openSourcesPanel = useCallback((turnId: string, sources: WebSourceItem[]) => {
    setSourcesPanel((prev) => (prev && prev.turnId === turnId ? null : { turnId, sources }))
  }, [])
  const closeSourcesPanel = useCallback(() => setSourcesPanel(null), [])

  const [filePreview, setFilePreview] = useState<{ name: string; fileId: string } | null>(null)
  const [filePreviewContent, setFilePreviewContent] = useState('')
  const openFilePreview = useCallback(async (name: string, fileIds: string[]) => {
    const fileId = fileIds[0]
    if (!fileId) return
    setFilePreview({ name, fileId })
    try {
      const res = await overlayAppClient.files.contentResponse(fileId)
      if (res.ok) {
        setFilePreviewContent(await res.text())
      } else {
        setFilePreviewContent('')
      }
    } catch {
      setFilePreviewContent('')
    }
  }, [])
  const closeFilePreview = useCallback(() => {
    setFilePreview(null)
    setFilePreviewContent('')
  }, [])

  return {
    closeFilePreview,
    closeSourcesPanel,
    filePreview,
    filePreviewContent,
    openFilePreview,
    openSourcesPanel,
    setSourcesPanel,
    sourcesPanel,
  }
}
