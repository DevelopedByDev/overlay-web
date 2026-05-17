'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  type GenerationMode,
  type VideoSubMode,
} from '@/lib/model-types'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/model-data'
import {
  ACT_MODEL_KEY,
  CHAT_MODEL_KEY,
} from '@/lib/chat-model-prefs'
import type { AskModelSelectionMode, GenerationResult } from './types'
import {
  CHAT_GEN_MODE_KEY,
  IMAGE_MODEL_SELECTION_MODE_KEY,
  SELECTED_IMAGE_MODELS_KEY,
  SELECTED_VIDEO_MODELS_KEY,
  VIDEO_MODEL_SELECTION_MODE_KEY,
  VIDEO_SUB_MODE_KEY,
} from './constants'

function readStoredModelIds(key: string, allowedIds: Set<string>): string[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const next = parsed
      .filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
      .slice(0, 4)
    return next.length > 0 ? next : null
  } catch {
    return null
  }
}

function readStoredSelectionMode(key: string): AskModelSelectionMode | null {
  const value = localStorage.getItem(key)
  return value === 'single' || value === 'multiple' ? value : null
}

export function useChatGenerationMode() {
  const [selectedActModel, setSelectedActModel] = useState<string>(DEFAULT_MODEL_ID)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODEL_ID])
  const [askModelSelectionMode, setAskModelSelectionMode] = useState<AskModelSelectionMode>('single')
  const [chatPrefsHydrated, setChatPrefsHydrated] = useState(false)
  const [generationMode, setGenerationMode] = useState<GenerationMode>('text')
  const [generationChip, setGenerationChip] = useState<'image' | 'video' | null>(null)
  const [generationResults, setGenerationResults] = useState<Map<number, GenerationResult[]>>(new Map())
  const [exchangeGenTypes, setExchangeGenTypes] = useState<('text' | 'image' | 'video')[]>([])
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
        }
      } catch {
        restoredSelectedModels = [saved]
      }
    }
    const savedAct = localStorage.getItem(ACT_MODEL_KEY)
    const savedMode = localStorage.getItem(CHAT_GEN_MODE_KEY) as GenerationMode | null

    const imgMode = readStoredSelectionMode(IMAGE_MODEL_SELECTION_MODE_KEY)
    const vidMode = readStoredSelectionMode(VIDEO_MODEL_SELECTION_MODE_KEY)

    const restoredImageModels = readStoredModelIds(
      SELECTED_IMAGE_MODELS_KEY,
      new Set(IMAGE_MODELS.map((model) => model.id)),
    )

    const restoredVideoModels = readStoredModelIds(
      SELECTED_VIDEO_MODELS_KEY,
      new Set(VIDEO_MODELS.map((model) => model.id)),
    )

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (restoredSelectedModels) setSelectedModels(restoredSelectedModels)
      if ((restoredSelectedModels?.length ?? 1) > 1) {
        setAskModelSelectionMode('multiple')
      }
      if (savedAct) setSelectedActModel(savedAct)
      if (savedMode && ['text', 'image', 'video'].includes(savedMode)) setGenerationMode(savedMode)
      if (imgMode) setImageModelSelectionMode(imgMode)
      if (vidMode) setVideoModelSelectionMode(vidMode)
      if (restoredImageModels) setSelectedImageModels(restoredImageModels)
      if (restoredVideoModels) setSelectedVideoModels(restoredVideoModels)
      setChatPrefsHydrated(true)
    })

    return () => {
      cancelled = true
    }
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
    generationResults,
    setGenerationResults,
    exchangeGenTypes,
    setExchangeGenTypes,
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
