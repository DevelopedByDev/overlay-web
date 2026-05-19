'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OverlaySidebarAction, OverlaySidebarActionKey } from '@overlay/app-core'
import { readNewChatModelFieldsFromStorage } from '@/lib/chat-model-prefs'
import { dispatchChatCreated } from '@/lib/chat-title'
import { upsertCachedChat } from '@/lib/chat-list-cache'
import { overlayAppClient } from '@/lib/overlay-app-client'
import type { GateReason } from '../GuestGateProvider'

export interface UseAppSidebarActionsOptions {
  user: object | null
  pathname: string
  searchParams: URLSearchParams
  requireAuth: (reason: GateReason) => void
  onCloseMobileMenu: () => void
  onChatCreated: () => void
  onProjectCreated: () => void
}

function isKnownActionKey(actionKey: OverlaySidebarActionKey): actionKey is
  | 'chat.create'
  | 'notes.create'
  | 'projects.create'
  | 'automations.create' {
  return (
    actionKey === 'chat.create' ||
    actionKey === 'notes.create' ||
    actionKey === 'projects.create' ||
    actionKey === 'automations.create'
  )
}

export function useAppSidebarActions({
  user,
  pathname,
  searchParams,
  requireAuth,
  onCloseMobileMenu,
  onChatCreated,
  onProjectCreated,
}: UseAppSidebarActionsOptions) {
  const router = useRouter()
  const [pendingActionKey, setPendingActionKey] = useState<OverlaySidebarActionKey | null>(null)

  const createChat = useCallback(async () => {
    if (!user) {
      requireAuth('send')
      return false
    }
    const models = readNewChatModelFieldsFromStorage()
    const res = await overlayAppClient.conversations.createResponse({
      title: 'New Chat',
      askModelIds: models.askModelIds,
      actModelId: models.actModelId,
      lastMode: models.lastMode,
    })
    if (!res.ok) return false
    const data = await res.json() as {
      id?: string
      conversation?: { _id: string; title: string; lastModified: number }
    }
    if (!data.id) return false
    const chat = data.conversation ?? { _id: data.id, title: 'New Chat', lastModified: 0 }
    upsertCachedChat(chat)
    dispatchChatCreated({ chat })
    onChatCreated()
    onCloseMobileMenu()
    router.push(`/app/chat?id=${encodeURIComponent(data.id)}`)
    return true
  }, [onChatCreated, onCloseMobileMenu, requireAuth, router, user])

  const createAutomationConversation = useCallback(async () => {
    if (!user) {
      requireAuth('send')
      return false
    }
    if (pendingActionKey === 'automations.create') return false
    setPendingActionKey('automations.create')
    const models = readNewChatModelFieldsFromStorage()
    const title = 'New automation'
    try {
      const res = await overlayAppClient.conversations.createResponse({
        title,
        askModelIds: models.askModelIds,
        actModelId: models.actModelId,
        lastMode: 'act',
      })
      if (!res.ok) return false
      const data = await res.json() as {
        id?: string
        conversation?: { _id: string; title: string; lastModified: number }
      }
      if (!data.id) return false
      const chat = data.conversation ?? { _id: data.id, title, lastModified: 0 }
      upsertCachedChat(chat)
      dispatchChatCreated({ chat })
      const automationRes = await overlayAppClient.automations.createResponse({
        name: title,
        description: 'Draft automation. Add a description before enabling it.',
        instructions: 'Describe what this automation should do.',
        enabled: false,
        schedule: { kind: 'daily', hourUTC: 14, minuteUTC: 0 },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        modelId: models.actModelId,
        sourceConversationId: data.id,
      })
      if (!automationRes.ok) return false
      const automationData = await automationRes.json() as { id?: string }
      const automationId = automationData.id ?? null
      if (!automationId) return false
      window.dispatchEvent(new Event('overlay:automations-updated'))
      onCloseMobileMenu()
      const query = new URLSearchParams({ id: data.id, automationId })
      router.push(`/app/automations?${query.toString()}`)
      return true
    } finally {
      setPendingActionKey(null)
    }
  }, [onCloseMobileMenu, pendingActionKey, requireAuth, router, user])

  const createNote = useCallback(async () => {
    if (!user) {
      requireAuth('nav')
      return false
    }
    const parentId = pathname.startsWith('/app/files') ? searchParams.get('folder') : null
    const res = await overlayAppClient.files.createResponse({
      kind: 'note',
      name: 'Untitled',
      textContent: '',
      parentId,
    })
    if (!res.ok) return false
    const data = await res.json() as {
      id?: string
      file?: {
        _id: string
        name?: string
        content?: string
        textContent?: string
        createdAt?: number
        updatedAt?: number
      }
    }
    if (!data.id) return false
    const file = data.file
    const updatedAt = file?.updatedAt ?? file?.createdAt ?? Number.MAX_SAFE_INTEGER
    window.dispatchEvent(new CustomEvent('overlay:notes-changed', {
      detail: {
        note: {
          _id: data.id,
          title: file?.name || 'Untitled',
          content: file?.textContent ?? file?.content ?? '',
          tags: [],
          createdAt: file?.createdAt ?? updatedAt,
          updatedAt,
        },
      },
    }))
    window.dispatchEvent(new CustomEvent('overlay:files-changed'))
    onCloseMobileMenu()
    router.push(`/app/notes?id=${encodeURIComponent(data.id)}`)
    return true
  }, [onCloseMobileMenu, pathname, requireAuth, router, searchParams, user])

  const createProject = useCallback(async () => {
    if (!user) {
      requireAuth('nav')
      return false
    }
    const res = await overlayAppClient.projects.createResponse({ name: 'Untitled Project' })
    if (!res.ok) return false
    onProjectCreated()
    onCloseMobileMenu()
    router.push('/app/projects')
    return true
  }, [onCloseMobileMenu, onProjectCreated, requireAuth, router, user])

  const runSidebarAction = useCallback(async (action: OverlaySidebarAction | null | undefined) => {
    if (!action) return false
    if (action.requiresAuth && !user) {
      requireAuth(action.actionKey === 'chat.create' || action.actionKey === 'automations.create' ? 'send' : 'nav')
      return false
    }
    if (!isKnownActionKey(action.actionKey)) {
      window.dispatchEvent(new CustomEvent('overlay:sidebar-action', { detail: { action } }))
      return false
    }
    if (action.actionKey === 'chat.create') return createChat()
    if (action.actionKey === 'notes.create') return createNote()
    if (action.actionKey === 'projects.create') return createProject()
    return createAutomationConversation()
  }, [
    createAutomationConversation,
    createChat,
    createNote,
    createProject,
    requireAuth,
    user,
  ])

  return {
    createChat,
    pendingActionKey,
    runSidebarAction,
  }
}
