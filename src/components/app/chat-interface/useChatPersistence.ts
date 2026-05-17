'use client'

import { useEffect } from 'react'
import { overlayAppClient } from '@/lib/overlay-app-client'

export function useChatPersistence({
  activeChatId,
  selectedModels,
  selectedActModel,
  persistActiveRuntimeUiState,
}: {
  activeChatId: string | null
  selectedModels: string[]
  selectedActModel: string
  persistActiveRuntimeUiState: () => void
}) {
  useEffect(() => {
    persistActiveRuntimeUiState()
  }, [persistActiveRuntimeUiState])

  useEffect(() => {
    if (!activeChatId) return
    const timer = window.setTimeout(() => {
      void overlayAppClient.conversations.updateResponse({
        conversationId: activeChatId,
        lastMode: 'act',
        askModelIds: selectedModels,
        actModelId: selectedActModel,
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [selectedModels, selectedActModel, activeChatId])
}
