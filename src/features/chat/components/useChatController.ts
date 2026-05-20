'use client'

import { useReducer } from 'react'
import type { WebSourceItem } from '@/shared/web/web-sources'

type FilePreviewState = {
  name: string
  fileId: string
  content: string
} | null

type ChatControllerState = {
  sourcesPanel: { turnId: string; sources: WebSourceItem[] } | null
  filePreview: FilePreviewState
  composerNotice: string | null
  mobileChatListOpen: boolean
}

type ChatControllerAction =
  | { type: 'toggleSources'; turnId: string; sources: WebSourceItem[] }
  | { type: 'closeSources' }
  | { type: 'openFilePreview'; name: string; fileId: string }
  | { type: 'setFilePreviewContent'; content: string }
  | { type: 'closeFilePreview' }
  | { type: 'setComposerNotice'; notice: string | null }
  | { type: 'setMobileChatListOpen'; open: boolean }
  | { type: 'resetTransientSurface' }

const initialState: ChatControllerState = {
  sourcesPanel: null,
  filePreview: null,
  composerNotice: null,
  mobileChatListOpen: false,
}

function chatControllerReducer(
  state: ChatControllerState,
  action: ChatControllerAction,
): ChatControllerState {
  switch (action.type) {
    case 'toggleSources':
      return {
        ...state,
        sourcesPanel:
          state.sourcesPanel?.turnId === action.turnId
            ? null
            : { turnId: action.turnId, sources: action.sources },
      }
    case 'closeSources':
      return { ...state, sourcesPanel: null }
    case 'openFilePreview':
      return { ...state, filePreview: { name: action.name, fileId: action.fileId, content: '' } }
    case 'setFilePreviewContent':
      return state.filePreview
        ? { ...state, filePreview: { ...state.filePreview, content: action.content } }
        : state
    case 'closeFilePreview':
      return { ...state, filePreview: null }
    case 'setComposerNotice':
      return { ...state, composerNotice: action.notice }
    case 'setMobileChatListOpen':
      return { ...state, mobileChatListOpen: action.open }
    case 'resetTransientSurface':
      return { ...state, sourcesPanel: null, composerNotice: null, mobileChatListOpen: false }
    default:
      return state
  }
}

export function useChatController() {
  return useReducer(chatControllerReducer, initialState)
}
