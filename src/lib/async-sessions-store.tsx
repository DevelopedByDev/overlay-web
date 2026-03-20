'use client'

import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react'

interface StreamingSession {
  id: string
  type: 'chat' | 'agent'
  title: string
  startedAt: number
  messageCountAtStart: number
  status: 'streaming' | 'done'
}

interface AsyncSessionsState {
  sessions: Record<string, StreamingSession>
  unreadCounts: Record<string, number>
  activeViewerIds: { chat: string | null; agent: string | null }
}

type Action =
  | { type: 'START_SESSION'; id: string; sessionType: 'chat' | 'agent'; title: string; messageCountAtStart: number }
  | { type: 'COMPLETE_SESSION'; id: string; isActive: boolean }
  | { type: 'MARK_READ'; id: string }
  | { type: 'SET_ACTIVE_VIEWER'; viewerType: 'chat' | 'agent'; id: string | null }

function reducer(state: AsyncSessionsState, action: Action): AsyncSessionsState {
  switch (action.type) {
    case 'START_SESSION': {
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.id]: {
            id: action.id,
            type: action.sessionType,
            title: action.title,
            startedAt: Date.now(),
            messageCountAtStart: action.messageCountAtStart,
            status: 'streaming',
          },
        },
      }
    }
    case 'COMPLETE_SESSION': {
      const session = state.sessions[action.id]
      if (!session || session.status === 'done') return state
      const newUnread = action.isActive
        ? state.unreadCounts
        : { ...state.unreadCounts, [action.id]: (state.unreadCounts[action.id] ?? 0) + 1 }
      return {
        ...state,
        sessions: { ...state.sessions, [action.id]: { ...session, status: 'done' } },
        unreadCounts: newUnread,
      }
    }
    case 'MARK_READ': {
      if (!state.unreadCounts[action.id]) return state
      const { [action.id]: _, ...rest } = state.unreadCounts
      void _
      return { ...state, unreadCounts: rest }
    }
    case 'SET_ACTIVE_VIEWER': {
      return {
        ...state,
        activeViewerIds: { ...state.activeViewerIds, [action.viewerType]: action.id },
      }
    }
    default:
      return state
  }
}

interface AsyncSessionsContextValue {
  startSession(id: string, type: 'chat' | 'agent', title: string, messageCountAtStart: number): void
  completeSession(id: string, isActive: boolean): void
  markRead(id: string): void
  setActiveViewer(type: 'chat' | 'agent', id: string | null): void
  getUnread(id: string): number
  sessions: Record<string, StreamingSession>
  activeViewerIds: { chat: string | null; agent: string | null }
  totalChatUnread: number
  totalAgentUnread: number
}

const AsyncSessionsContext = createContext<AsyncSessionsContextValue | null>(null)

const INITIAL_STATE: AsyncSessionsState = {
  sessions: {},
  unreadCounts: {},
  activeViewerIds: { chat: null, agent: null },
}

export function AsyncSessionsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Stable dispatch wrappers — don't change on every render
  const startSession = useCallback((id: string, type: 'chat' | 'agent', title: string, messageCountAtStart: number) => {
    dispatch({ type: 'START_SESSION', id, sessionType: type, title, messageCountAtStart })
  }, [])

  const completeSession = useCallback((id: string, isActive: boolean) => {
    dispatch({ type: 'COMPLETE_SESSION', id, isActive })
  }, [])

  const markRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', id })
  }, [])

  const setActiveViewer = useCallback((viewerType: 'chat' | 'agent', id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_VIEWER', viewerType, id })
  }, [])

  const value = useMemo<AsyncSessionsContextValue>(() => ({
    startSession,
    completeSession,
    markRead,
    setActiveViewer,
    getUnread: (id: string) => state.unreadCounts[id] ?? 0,
    sessions: state.sessions,
    activeViewerIds: state.activeViewerIds,
    totalChatUnread: Object.entries(state.unreadCounts)
      .filter(([id]) => state.sessions[id]?.type === 'chat')
      .reduce((sum, [, count]) => sum + count, 0),
    totalAgentUnread: Object.entries(state.unreadCounts)
      .filter(([id]) => state.sessions[id]?.type === 'agent')
      .reduce((sum, [, count]) => sum + count, 0),
  }), [state, startSession, completeSession, markRead, setActiveViewer])

  return (
    <AsyncSessionsContext.Provider value={value}>
      {children}
    </AsyncSessionsContext.Provider>
  )
}

export function useAsyncSessions(): AsyncSessionsContextValue {
  const ctx = useContext(AsyncSessionsContext)
  if (!ctx) throw new Error('useAsyncSessions must be used within AsyncSessionsProvider')
  return ctx
}
