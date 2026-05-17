'use client'

/* eslint-disable react-hooks/refs */

import { useCallback, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useChat } from '@ai-sdk/react'
import {
  cloneConversationUiState,
  cloneGenerationResultsMap,
  createConversationUiState,
} from '@overlay/chat-core'
import type {
  AskModelSelectionMode,
  ConversationRuntime,
  ConversationUiState,
  GenerationResult,
} from './types'
import { createConversationRuntime } from './chatRuntime'

export function useChatRuntimes({
  activeChatId,
  activeChatIdRef,
  selectedActModel,
  selectedModels,
  askModelSelectionMode,
  exchangeModes,
  exchangeModels,
  selectedTabPerExchange,
  activeChatTitle,
  generationResults,
  exchangeGenTypes,
  isFirstMessage,
  lastGeneratedImageUrlRef,
  setSelectedActModel,
  setSelectedModels,
  setAskModelSelectionMode,
  setExchangeModes,
  setExchangeModels,
  setSelectedTabPerExchange,
  setActiveChatTitle,
  setGenerationResults,
  setExchangeGenTypes,
  setIsFirstMessage,
}: {
  activeChatId: string | null
  activeChatIdRef: MutableRefObject<string | null>
  selectedActModel: string
  selectedModels: string[]
  askModelSelectionMode: AskModelSelectionMode
  exchangeModes: ('ask' | 'act')[]
  exchangeModels: string[][]
  selectedTabPerExchange: number[]
  activeChatTitle: string | null
  generationResults: Map<number, GenerationResult[]>
  exchangeGenTypes: ('text' | 'image' | 'video')[]
  isFirstMessage: boolean
  lastGeneratedImageUrlRef: MutableRefObject<string | null>
  setSelectedActModel: Dispatch<SetStateAction<string>>
  setSelectedModels: Dispatch<SetStateAction<string[]>>
  setAskModelSelectionMode: Dispatch<SetStateAction<AskModelSelectionMode>>
  setExchangeModes: Dispatch<SetStateAction<('ask' | 'act')[]>>
  setExchangeModels: Dispatch<SetStateAction<string[][]>>
  setSelectedTabPerExchange: Dispatch<SetStateAction<number[]>>
  setActiveChatTitle: Dispatch<SetStateAction<string | null>>
  setGenerationResults: Dispatch<SetStateAction<Map<number, GenerationResult[]>>>
  setExchangeGenTypes: Dispatch<SetStateAction<('text' | 'image' | 'video')[]>>
  setIsFirstMessage: Dispatch<SetStateAction<boolean>>
}) {
  const runtimesRef = useRef(new Map<string, ConversationRuntime>())
  const emptyRuntimeRef = useRef(createConversationRuntime('__empty__'))

  const ensureConversationRuntime = useCallback((chatId: string, uiOverrides?: Partial<ConversationUiState>) => {
    const existing = runtimesRef.current.get(chatId)
    if (existing) {
      if (uiOverrides) {
        existing.ui = createConversationUiState({
          ...existing.ui,
          ...uiOverrides,
          generationResults: uiOverrides.generationResults ?? existing.ui.generationResults,
          orphanModelThreads: uiOverrides.orphanModelThreads ?? existing.ui.orphanModelThreads,
        })
      }
      return existing
    }

    const runtime = createConversationRuntime(chatId, uiOverrides)
    runtimesRef.current.set(chatId, runtime)
    return runtime
  }, [])

  const applyUiStateToView = useCallback((ui: ConversationUiState) => {
    setSelectedActModel(ui.selectedActModel)
    setSelectedModels([...ui.selectedModels])
    setAskModelSelectionMode(ui.askModelSelectionMode)
    setExchangeModes([...ui.exchangeModes])
    setExchangeModels(ui.exchangeModels.map((models) => [...models]))
    setSelectedTabPerExchange([...ui.selectedTabPerExchange])
    setActiveChatTitle(ui.activeChatTitle)
    setGenerationResults(cloneGenerationResultsMap(ui.generationResults))
    setExchangeGenTypes([...ui.exchangeGenTypes])
    setIsFirstMessage(ui.isFirstMessage)
    lastGeneratedImageUrlRef.current = ui.lastGeneratedImageUrl
  }, [
    lastGeneratedImageUrlRef,
    setActiveChatTitle,
    setAskModelSelectionMode,
    setExchangeGenTypes,
    setExchangeModels,
    setExchangeModes,
    setGenerationResults,
    setIsFirstMessage,
    setSelectedActModel,
    setSelectedModels,
    setSelectedTabPerExchange,
  ])

  const buildActiveUiStateSnapshot = useCallback((): ConversationUiState => {
    const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : null
    return createConversationUiState({
      selectedActModel,
      selectedModels,
      askModelSelectionMode,
      exchangeModes,
      exchangeModels,
      selectedTabPerExchange,
      activeChatTitle,
      generationResults,
      exchangeGenTypes,
      isFirstMessage,
      orphanModelThreads: activeRuntime?.ui.orphanModelThreads,
      lastGeneratedImageUrl: lastGeneratedImageUrlRef.current,
    })
  }, [
    activeChatId,
    activeChatTitle,
    askModelSelectionMode,
    ensureConversationRuntime,
    exchangeGenTypes,
    exchangeModels,
    exchangeModes,
    generationResults,
    isFirstMessage,
    lastGeneratedImageUrlRef,
    selectedActModel,
    selectedModels,
    selectedTabPerExchange,
  ])

  const persistActiveRuntimeUiState = useCallback(() => {
    if (!activeChatId) return
    const runtime = ensureConversationRuntime(activeChatId)
    if (!runtime.hydrated) return
    runtime.ui = buildActiveUiStateSnapshot()
  }, [activeChatId, buildActiveUiStateSnapshot, ensureConversationRuntime])

  const updateRuntimeUiState = useCallback((
    chatId: string,
    updater: (prev: ConversationUiState) => ConversationUiState,
  ) => {
    const runtime = ensureConversationRuntime(chatId)
    runtime.ui = updater(cloneConversationUiState(runtime.ui))
    if (activeChatIdRef.current === chatId) {
      applyUiStateToView(runtime.ui)
    }
  }, [activeChatIdRef, applyUiStateToView, ensureConversationRuntime])

  const activeRuntime = activeChatId ? ensureConversationRuntime(activeChatId) : emptyRuntimeRef.current
  const chat0 = useChat({ chat: activeRuntime.askChats[0] })
  const chat1 = useChat({ chat: activeRuntime.askChats[1] })
  const chat2 = useChat({ chat: activeRuntime.askChats[2] })
  const chat3 = useChat({ chat: activeRuntime.askChats[3] })
  const actChat = useChat({ chat: activeRuntime.actChat })
  const chatInstances = useMemo(() => [chat0, chat1, chat2, chat3], [chat0, chat1, chat2, chat3])
  const activeAskChats = activeRuntime.askChats
  const activeChatHydrated = Boolean(
    activeChatId && runtimesRef.current.get(activeChatId)?.hydrated,
  )

  return {
    runtimesRef,
    emptyRuntimeRef,
    ensureConversationRuntime,
    applyUiStateToView,
    buildActiveUiStateSnapshot,
    persistActiveRuntimeUiState,
    updateRuntimeUiState,
    activeRuntime,
    activeAskChats,
    activeChatHydrated,
    chat0,
    chat1,
    chat2,
    chat3,
    actChat,
    chatInstances,
  }
}
