'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import type { AskModelSelectionMode } from '../chat-interface/types'
import type { GenerationMode, VideoSubMode } from '@/shared/ai/gateway/model-types'
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
} from '@/shared/ai/gateway/model-types'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/shared/ai/gateway/model-data'
import {
  ACT_MODEL_KEY,
  CHAT_MODEL_KEY,
} from '@/shared/chat/chat-model-prefs'
import {
  CHAT_GEN_MODE_KEY,
  IMAGE_MODEL_SELECTION_MODE_KEY,
  SELECTED_IMAGE_MODELS_KEY,
  SELECTED_VIDEO_MODELS_KEY,
  VIDEO_MODEL_SELECTION_MODE_KEY,
  VIDEO_SUB_MODE_KEY,
} from '../chat-interface/constants'

export function useChatPreferences() {
  const [selectedActModel, setSelectedActModel] = useState<string>(DEFAULT_MODEL_ID)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])
  const [askModelSelectionMode, setAskModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [chatPrefsHydrated, setChatPrefsHydrated] = useState(false)
  const [generationMode, setGenerationMode] = useState<GenerationMode>('text')
  const [generationChip, setGenerationChip] = useState<'image' | 'video' | null>(null)
  const [selectedImageModels, setSelectedImageModels] = useState<string[]>([DEFAULT_IMAGE_MODEL_ID])
  const [selectedVideoModels, setSelectedVideoModels] = useState<string[]>([DEFAULT_VIDEO_MODEL_ID])
  const [imageModelSelectionMode, setImageModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [videoModelSelectionMode, setVideoModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [videoSubMode, setVideoSubMode] = useState<VideoSubMode>(() => {
    try {
      const saved = localStorage.getItem(VIDEO_SUB_MODE_KEY)
      return (saved as VideoSubMode | null) ?? 'text-to-video'
    } catch {
      return 'text-to-video'
    }
  })
  const lastGeneratedImageUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(CHAT_MODEL_KEY)
    let restoredSelectedModels: string[] | null = null
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          restoredSelectedModels = parsed.slice(0, 4)
          setSelectedModels(restoredSelectedModels)
        }
      } catch {
        restoredSelectedModels = [saved]
        setSelectedModels(restoredSelectedModels)
      }
    }
    if ((restoredSelectedModels?.length ?? 1) > 1) {
      setAskModelSelectionMode('multiple')
    }
    const savedAct = localStorage.getItem(ACT_MODEL_KEY)
    if (savedAct) setSelectedActModel(savedAct)
    const savedMode = localStorage.getItem(CHAT_GEN_MODE_KEY) as GenerationMode | null
    if (savedMode && ['text', 'image', 'video'].includes(savedMode)) setGenerationMode(savedMode)

    const imgMode = localStorage.getItem(IMAGE_MODEL_SELECTION_MODE_KEY)
    if (imgMode === 'single' || imgMode === 'multiple') {
      setImageModelSelectionMode(imgMode)
    }
    const vidMode = localStorage.getItem(VIDEO_MODEL_SELECTION_MODE_KEY)
    if (vidMode === 'single' || vidMode === 'multiple') {
      setVideoModelSelectionMode(vidMode)
    }
    try {
      const rawImg = localStorage.getItem(SELECTED_IMAGE_MODELS_KEY)
      if (rawImg) {
        const parsed = JSON.parse(rawImg) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowed = new Set(IMAGE_MODELS.map((m) => m.id))
          const next = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id)).slice(0, 4)
          if (next.length > 0) setSelectedImageModels(next)
        }
      }
    } catch {
      /* keep default */
    }
    try {
      const rawVid = localStorage.getItem(SELECTED_VIDEO_MODELS_KEY)
      if (rawVid) {
        const parsed = JSON.parse(rawVid) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allowed = new Set(VIDEO_MODELS.map((m) => m.id))
          const next = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id)).slice(0, 4)
          if (next.length > 0) setSelectedVideoModels(next)
        }
      }
    } catch {
      /* keep default */
    }

    setChatPrefsHydrated(true)
  }, [])

  return {
    selectedActModel,
    setSelectedActModel,
    selectedModels,
    setSelectedModels,
    askModelSelectionMode,
    setAskModelSelectionMode,
    chatPrefsHydrated,
    generationMode,
    setGenerationMode,
    generationChip,
    setGenerationChip,
    selectedImageModels,
    setSelectedImageModels,
    selectedVideoModels,
    setSelectedVideoModels,
    imageModelSelectionMode,
    setImageModelSelectionMode,
    videoModelSelectionMode,
    setVideoModelSelectionMode,
    videoSubMode,
    setVideoSubMode,
    lastGeneratedImageUrlRef,
  }
}
