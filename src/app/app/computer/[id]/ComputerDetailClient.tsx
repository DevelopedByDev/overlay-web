'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { AlertCircle, ChevronDown, Loader2, Plus, Send } from 'lucide-react'
import { MarkdownMessage } from '@/components/app/MarkdownMessage'
import { DelayedTooltip } from '@/components/app/DelayedTooltip'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/models'
import ComputerWorkspaceFileView from '@/components/app/ComputerWorkspaceFileView'
import { getFileType, isEditableType } from '@/components/app/FileViewer'
import { CommandBubble, CommandResultCard } from '@/components/app/ComputerCommandResults'
import {
  type ComputerCommandResult,
  buildComputerCommandCatalogResult,
  getComputerCommandLabel,
  getComputerCommandMenuItems,
  parseStandaloneComputerCommand,
  resolveOverlayModelSelection,
} from '@/lib/computer-commands'

type ComputerStatus =
  | 'pending_payment'
  | 'provisioning'
  | 'ready'
  | 'error'
  | 'past_due'
  | 'deleted'

interface Computer {
  _id: string
  name: string
  status: ComputerStatus
  provisioningStep?: string
  errorMessage?: string
  hetznerServerIp?: string
  pastDueAt?: number
  chatSessionKey?: string
  chatRequestedModelId?: string
  chatRequestedModelRef?: string
  chatEffectiveModel?: string
  chatEffectiveProvider?: string
  chatModelResolvedAt?: number
}

interface ModelUpdateResponse {
  ok: boolean
  requestedModelId: string
  requestedModelRef: string
  sessionKey: string
  effectiveProvider: string | null
  effectiveModel: string | null
}

interface LogEvent {
  _id: string
  type: string
  message: string
  createdAt: number
}

interface ComputerSession {
  key: string
  title: string
  updatedAt: number | null
}

interface ComputerSessionsEventDetail {
  computerId?: string
  type?: 'created' | 'updated' | 'deleted'
  sessionKey?: string
  deletedSessionKey?: string
  title?: string
}

type ComputerCommandMessageMetadata =
  | {
      overlayKind: 'computer-command-user'
      commandId: string
      sessionKey: string
    }
  | {
      overlayKind: 'computer-command-result'
      commandId: string
      sessionKey: string
      result: ComputerCommandResult
    }

type ComputerUiMessage = UIMessage<ComputerCommandMessageMetadata>

function stepIndex(step?: string): number {
  if (!step) return 0
  const map: Record<string, number> = {
    creating_server: 1,
    server_created: 2,
    openclaw_starting: 3,
  }
  return map[step] ?? 0
}

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return ''
  return msg.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text || '')
    .join('')
}

function isCommandMetadata(
  metadata: unknown
): metadata is ComputerCommandMessageMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false
  }

  const value = metadata as { overlayKind?: string }
  return (
    value.overlayKind === 'computer-command-user' ||
    value.overlayKind === 'computer-command-result'
  )
}

function isLocalCommandMessage(message: { metadata?: unknown }) {
  return isCommandMetadata(message.metadata)
}

function isCommandResultMessage(
  message: { metadata?: unknown }
): message is { metadata: Extract<ComputerCommandMessageMetadata, { overlayKind: 'computer-command-result' }> } {
  return isCommandMetadata(message.metadata) && message.metadata.overlayKind === 'computer-command-result'
}

async function generateTitle(text: string): Promise<string | null> {
  try {
    const response = await fetch('/api/app/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) return null
    const data = await response.json()
    return (data.title as string)?.trim() || null
  } catch {
    return null
  }
}

function dispatchComputerSessionsUpdated(detail: {
  computerId: string
  type?: 'created' | 'updated' | 'deleted'
  sessionKey?: string
  deletedSessionKey?: string
  title?: string
}) {
  window.dispatchEvent(
    new CustomEvent<ComputerSessionsEventDetail>('overlay:computer-sessions-updated', {
      detail,
    })
  )
}

function ProvisioningView({ step, logs }: { step?: string; logs: LogEvent[] }) {
  const current = stepIndex(step)
  const labels = ['Paid', 'Server', 'Docker', 'Ready']
  const messages: Record<string, string> = {
    creating_server: 'Creating server on Hetzner... (1-2 min)',
    server_created: 'Pulling OpenClaw image and writing gateway config...',
    openclaw_starting: 'Starting OpenClaw gateway and waiting for healthz...',
  }
  const terminalRef = useRef<HTMLDivElement>(null)

  const lines = logs
    .filter((event) => event.type === 'provisioning_log' || event.type === 'provision_log')
    .flatMap((event) => event.message.split('\n'))

  useEffect(() => {
    if (!terminalRef.current) return
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines.length])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col items-center gap-6 px-8 pb-6 pt-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-0">
            {labels.map((label, index) => {
              const done = index < current
              const active = index === current
              return (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`h-3 w-3 rounded-full border-2 transition-all ${
                        done
                          ? 'border-[#0a0a0a] bg-[#0a0a0a]'
                          : active
                            ? 'border-[#0a0a0a] bg-white ring-2 ring-[#0a0a0a]/20'
                            : 'border-[#ddd] bg-white'
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        done || active ? 'font-medium text-[#0a0a0a]' : 'text-[#bbb]'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < labels.length - 1 && (
                    <div
                      className={`mx-1 mb-4 h-px flex-1 ${
                        index < current ? 'bg-[#0a0a0a]' : 'bg-[#e5e5e5]'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="space-y-1 text-center">
            <p className="text-sm text-[#525252]">
              {step ? messages[step] ?? 'Setting up your computer...' : 'Waiting for server creation...'}
            </p>
            <p className="text-xs text-[#aaa]">This usually takes 10-15 minutes in total</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <div
          ref={terminalRef}
          className="h-full overflow-y-auto rounded-xl bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed"
        >
          {lines.length === 0 ? (
            <span className="text-[#444]">Waiting for VPS setup logs...</span>
          ) : (
            lines.map((line, index) => (
              <div key={index} className="whitespace-pre text-[#4ade80]">
                {line || '\u00a0'}
              </div>
            ))
          )}
          <div className="ml-0.5 inline-block h-3.5 w-2 animate-pulse bg-[#4ade80] align-text-bottom" />
        </div>
      </div>
    </div>
  )
}

export default function ComputerDetailClient({
  computerId,
}: {
  computerId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = searchParams?.get('view') ?? null
  const requestedFileName = searchParams?.get('file')?.trim() || ''
  const requestedSessionKey = searchParams?.get('sessionKey')?.trim() || null
  const isWorkspaceFileView = currentView === 'file' && Boolean(requestedFileName)
  const justPaid = searchParams?.get('paid') === '1'
  const checkoutSessionId = searchParams?.get('session_id')?.trim() || null
  const [now] = useState(Date.now)
  const [computer, setComputer] = useState<Computer | null | undefined>(undefined)
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [sessions, setSessions] = useState<ComputerSession[]>([])
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(requestedSessionKey)
  const [activeSessionTitle, setActiveSessionTitle] = useState('New Chat')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID)
  const [hasHydratedSelectedModel, setHasHydratedSelectedModel] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [hydratedTranscriptKey, setHydratedTranscriptKey] = useState<string | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isEditingMarkdownFile, setIsEditingMarkdownFile] = useState(false)
  const [input, setInput] = useState('')
  const [activeSlashIndex, setActiveSlashIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedModelRef = useRef(selectedModel)
  const activeSessionKeyRef = useRef(activeSessionKey)
  const hydrateRequestIdRef = useRef(0)
  const activatedCheckoutSessionRef = useRef<string | null>(null)
  const latestComputerStatusRef = useRef<ComputerStatus | null>(null)

  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

  useEffect(() => {
    activeSessionKeyRef.current = activeSessionKey
  }, [activeSessionKey])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/app/computer-chat',
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages: messages.filter((message) => !isLocalCommandMessage(message)),
            computerId,
            modelId: selectedModelRef.current,
            sessionKey: activeSessionKeyRef.current,
          },
        }),
      }),
    [computerId]
  )

  const { messages, sendMessage, setMessages, status, stop, error } = useChat<ComputerUiMessage>({ transport })
  const isLoading = status === 'streaming' || status === 'submitted'
  const wasChatLoadingRef = useRef(false)

  useEffect(() => {
    if (computer?.status !== 'ready' || isWorkspaceFileView) return

    function onGlobalKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.shiftKey && (e.key === '/' || e.key === '?')) {
        e.preventDefault()
        setShowModelPicker(true)
        return
      }
      if (e.key === '/' && !meta && !e.altKey && !e.shiftKey) {
        const t = e.target as HTMLElement | null
        if (!t) return
        if (textareaRef.current && (t === textareaRef.current || textareaRef.current.contains(t))) return
        if (t.closest('input, textarea, select, [contenteditable="true"]')) return
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown, true)
    return () => window.removeEventListener('keydown', onGlobalKeyDown, true)
  }, [computer?.status, isWorkspaceFileView])

  useEffect(() => {
    const loading = status === 'streaming' || status === 'submitted'
    if (wasChatLoadingRef.current && !loading) {
      window.dispatchEvent(new CustomEvent('overlay:subscription-refresh'))
    }
    wasChatLoadingRef.current = loading
  }, [status])

  const lastMessage = [...messages].reverse().find((message) => !isLocalCommandMessage(message))
  const showLoadingIndicator =
    isLoading &&
    !(
      lastMessage?.role === 'assistant' &&
      getMessageText(lastMessage).trim().length > 0
    )

  const fetchComputerPayload = useCallback(async (options?: { includeLogs?: boolean; background?: boolean }) => {
    try {
      const query = options?.includeLogs ? '?logs=1' : ''
      const response = await fetch(`/api/app/computers/${computerId}${query}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 404) {
          setComputer(null)
        }
        return null
      }

      const payload = await response.json() as { computer?: Computer | null; logs?: LogEvent[] }
      const nextComputer = payload.computer ?? null
      setComputer(nextComputer)
      const nextStatus = nextComputer?.status ?? null
      if (latestComputerStatusRef.current !== nextStatus) {
        latestComputerStatusRef.current = nextStatus
        window.dispatchEvent(
          new CustomEvent('overlay:computers-updated', {
            detail: {
              computerId,
              type: 'updated',
              status: nextStatus,
            },
          })
        )
      }
      if (Array.isArray(payload.logs)) {
        setLogs(payload.logs)
      }
      return payload
    } catch {
      if (!options?.background) {
        setComputer(null)
      }
      return null
    }
  }, [computerId])

  const fetchComputer = useCallback(async () => {
    await fetchComputerPayload()
  }, [fetchComputerPayload])

  const fetchComputerInBackground = useCallback(async () => {
    await fetchComputerPayload({ background: true })
  }, [fetchComputerPayload])

  const fetchLogs = useCallback(async () => {
    await fetchComputerPayload({ includeLogs: true })
  }, [fetchComputerPayload])

  const fetchLogsInBackground = useCallback(async () => {
    await fetchComputerPayload({ includeLogs: true, background: true })
  }, [fetchComputerPayload])

  const loadSessions = useCallback(async () => {
    const response = await fetch(`/api/app/computer-sessions?computerId=${computerId}`)
    if (!response.ok) return null
    const data = await response.json()
    const nextSessions = Array.isArray(data.sessions) ? data.sessions as ComputerSession[] : []
    setSessions(nextSessions)
    return {
      activeSessionKey: data.activeSessionKey as string | null,
      sessions: nextSessions,
    }
  }, [computerId])

  const hydrateMessages = useCallback(async (sessionKey: string) => {
    const requestId = ++hydrateRequestIdRef.current
    const response = await fetch(
      `/api/app/computer-sessions?computerId=${computerId}&sessionKey=${encodeURIComponent(sessionKey)}&messages=true`
    )
    if (!response.ok) return
    const data = await response.json()
    if (
      requestId !== hydrateRequestIdRef.current ||
      activeSessionKeyRef.current !== sessionKey
    ) {
      return
    }
    setMessages((Array.isArray(data.messages) ? data.messages : []) as ComputerUiMessage[])
    setHydratedTranscriptKey(sessionKey)
  }, [computerId, setMessages])

  const syncComputerRuntime = useCallback((
    payload: ModelUpdateResponse,
    options?: { emitEvent?: boolean; eventType?: 'created' | 'updated' | 'deleted' }
  ) => {
    setComputer((current) => {
      if (!current) return current
      return {
        ...current,
        chatSessionKey: payload.sessionKey,
        chatRequestedModelId: payload.requestedModelId,
        chatRequestedModelRef: payload.requestedModelRef,
        chatEffectiveProvider: payload.effectiveProvider ?? undefined,
        chatEffectiveModel: payload.effectiveModel ?? undefined,
        chatModelResolvedAt: Date.now(),
      }
    })
    setSelectedModel(payload.requestedModelId)
    setActiveSessionKey(payload.sessionKey)
    if (options?.emitEvent !== false) {
      dispatchComputerSessionsUpdated({
        computerId,
        type: options?.eventType ?? 'updated',
        sessionKey: payload.sessionKey,
      })
    }
  }, [computerId])

  const refreshSessions = useCallback(async (preferredSessionKey?: string | null) => {
    const data = await loadSessions()
    if (!data) return
    const resolvedKey = preferredSessionKey || activeSessionKey
    if (!resolvedKey) return
    const matchingSession = data.sessions.find((session) => session.key === resolvedKey)
    if (matchingSession) {
      setActiveSessionTitle(matchingSession.title)
    }
  }, [activeSessionKey, loadSessions])

  const selectSession = useCallback(async (sessionKey: string) => {
    const response = await fetch('/api/app/computer-sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        computerId,
        sessionKey,
      }),
    })
    if (!response.ok) return
    const payload = await response.json() as ModelUpdateResponse
    syncComputerRuntime(payload)
    setHydratedTranscriptKey(null)
    await fetchComputer()
    await refreshSessions(payload.sessionKey)
  }, [computerId, fetchComputer, refreshSessions, syncComputerRuntime])

  const renameSession = useCallback(async (sessionKey: string, title: string) => {
    if (!title.trim()) return
    await fetch('/api/app/computer-sessions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        computerId,
        sessionKey,
        label: title,
      }),
    })
    setActiveSessionTitle(title)
    setSessions((current) =>
      current.map((session) => (
        session.key === sessionKey
          ? { ...session, title, updatedAt: Date.now() }
          : session
      ))
    )
    dispatchComputerSessionsUpdated({
      computerId,
      type: 'updated',
      sessionKey,
      title,
    })
  }, [computerId])

  const requestNewSession = useCallback(async (modelIdOverride?: string) => {
    const response = await fetch('/api/app/computer-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        computerId,
        modelId: modelIdOverride?.trim() || selectedModelRef.current,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error || 'Failed to create chat')
    }

    return await response.json() as ModelUpdateResponse
  }, [computerId])

  const applyCreatedSession = useCallback((payload: ModelUpdateResponse, options?: { replace?: boolean }) => {
    syncComputerRuntime(payload, { emitEvent: false })
    setMessages([])
    setInput('')
    setActiveSessionTitle('New Chat')
    setSessions((current) => [
      {
        key: payload.sessionKey,
        title: 'New Chat',
        updatedAt: Date.now(),
      },
      ...current.filter((session) => session.key !== payload.sessionKey),
    ])
    setHydratedTranscriptKey(null)
    dispatchComputerSessionsUpdated({
      computerId,
      type: 'created',
      sessionKey: payload.sessionKey,
      title: 'New Chat',
    })

    const href = `/app/computer/${computerId}?view=session&sessionKey=${encodeURIComponent(payload.sessionKey)}`
    if (options?.replace) {
      router.replace(href)
      return
    }
    router.push(href)
  }, [computerId, router, setMessages, syncComputerRuntime])

  const createNewSession = useCallback(async (modelIdOverride?: string) => {
    if (isLoading || isCreatingSession) return
    setIsCreatingSession(true)
    try {
      const payload = await requestNewSession(modelIdOverride)
      applyCreatedSession(payload)
      await loadSessions()
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create chat'
      window.alert(message)
      return null
    } finally {
      setIsCreatingSession(false)
    }
  }, [
    applyCreatedSession,
    isCreatingSession,
    isLoading,
    loadSessions,
    requestNewSession,
  ])

  useEffect(() => {
    void fetchComputer()
  }, [fetchComputer])

  useEffect(() => {
    if (!justPaid || !checkoutSessionId) return
    if (activatedCheckoutSessionRef.current === checkoutSessionId) return
    activatedCheckoutSessionRef.current = checkoutSessionId

    async function activatePaidComputer() {
      const response = await fetch(`/api/app/computers/${computerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: checkoutSessionId }),
      })

      if (!response.ok) {
        return
      }

      await fetchComputer()
      await fetchLogs()
    }

    void activatePaidComputer()
  }, [checkoutSessionId, computerId, fetchComputer, fetchLogs, justPaid])

  useEffect(() => {
    if (computer === undefined) return

    const intervalMs =
      computer?.status === 'provisioning' || computer?.status === 'pending_payment' ? 4000 : 20000

    const intervalId = window.setInterval(() => {
      void fetchComputerInBackground()
    }, intervalMs)

    return () => window.clearInterval(intervalId)
  }, [computer, fetchComputerInBackground])

  useEffect(() => {
    if (computer?.status !== 'provisioning') return

    void fetchLogs()
    const intervalId = window.setInterval(() => {
      void fetchLogsInBackground()
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [computer?.status, fetchLogs, fetchLogsInBackground])

  useEffect(() => {
    if (computer?.status !== 'ready' || isWorkspaceFileView) return
    let cancelled = false

    async function syncSessions() {
      const data = await loadSessions()
      if (!data || cancelled) return

      const nextActiveKey =
        requestedSessionKey ||
        computer?.chatSessionKey?.trim() ||
        data.activeSessionKey ||
        data.sessions[0]?.key ||
        null

      if (nextActiveKey) {
        setActiveSessionKey(nextActiveKey)
        const matchingSession = data.sessions.find((session) => session.key === nextActiveKey)
        setActiveSessionTitle(matchingSession?.title || 'New Chat')
        return
      }

      if (!isCreatingSession) {
        setIsCreatingSession(true)
        try {
          const payload = await requestNewSession()
          if (cancelled) return
          applyCreatedSession(payload, { replace: true })
          await loadSessions()
        } finally {
          if (!cancelled) {
            setIsCreatingSession(false)
          }
        }
      }
    }

    void syncSessions()

    return () => {
      cancelled = true
    }
  }, [
    computer?.chatSessionKey,
    computer?.status,
    applyCreatedSession,
    isCreatingSession,
    isWorkspaceFileView,
    loadSessions,
    requestedSessionKey,
    requestNewSession,
  ])

  useEffect(() => {
    if (requestedSessionKey) {
      setActiveSessionKey(requestedSessionKey)
      const matchingSession = sessions.find((session) => session.key === requestedSessionKey)
      setActiveSessionTitle(matchingSession?.title || 'New Chat')
    }
  }, [requestedSessionKey, sessions])

  useEffect(() => {
    if (!activeSessionKey) return
    const matchingSession = sessions.find((session) => session.key === activeSessionKey)
    if (matchingSession) {
      setActiveSessionTitle(matchingSession.title)
    }
  }, [activeSessionKey, sessions])

  useEffect(() => {
    if (computer?.status !== 'ready' || !requestedSessionKey) return
    if (requestedSessionKey === computer.chatSessionKey) return
    void selectSession(requestedSessionKey)
  }, [computer?.chatSessionKey, computer?.status, requestedSessionKey, selectSession])

  useEffect(() => {
    if (computer?.status !== 'ready') return

    function handleSessionsUpdated(event: Event) {
      const detail = (event as CustomEvent<ComputerSessionsEventDetail>).detail
      if (detail?.computerId !== computerId) return

      const nextSessionKey = detail.sessionKey?.trim() || null
      const deletedSessionKey = detail.deletedSessionKey?.trim() || null
      const deletingCurrentSession =
        Boolean(deletedSessionKey) &&
        (deletedSessionKey === requestedSessionKey || deletedSessionKey === activeSessionKey)
      if (!deletingCurrentSession) {
        return
      }

      void loadSessions().then((data) => {
        if (!data) return

        const resolvedSessionKey =
          (deletingCurrentSession ? nextSessionKey : null) ||
          requestedSessionKey ||
          activeSessionKey ||
          data.activeSessionKey ||
          data.sessions[0]?.key ||
          null

        setMessages([])
        setHydratedTranscriptKey(null)
        setActiveSessionKey(resolvedSessionKey)
        setActiveSessionTitle(
          data.sessions.find((session) => session.key === resolvedSessionKey)?.title || 'New Chat'
        )

        if (resolvedSessionKey) {
          router.replace(
            `/app/computer/${computerId}?view=session&sessionKey=${encodeURIComponent(resolvedSessionKey)}`
          )
        } else {
          router.replace(`/app/computer/${computerId}`)
        }
      })
    }

    window.addEventListener('overlay:computer-sessions-updated', handleSessionsUpdated)
    return () => {
      window.removeEventListener('overlay:computer-sessions-updated', handleSessionsUpdated)
    }
  }, [activeSessionKey, computer?.status, computerId, loadSessions, requestedSessionKey, router, setMessages])

  useEffect(() => {
    setMessages([])
    setHydratedTranscriptKey(null)
    hydrateRequestIdRef.current += 1
  }, [activeSessionKey, setMessages])

  useEffect(() => {
    setIsEditingMarkdownFile(false)
  }, [requestedFileName])

  useEffect(() => {
    if (computer?.status !== 'ready' || isWorkspaceFileView || !activeSessionKey) return
    if (hydratedTranscriptKey === activeSessionKey) return
    void hydrateMessages(activeSessionKey)
  }, [
    activeSessionKey,
    computer?.status,
    hydrateMessages,
    hydratedTranscriptKey,
    isWorkspaceFileView,
  ])

  useEffect(() => {
    if (hasHydratedSelectedModel || computer === undefined) return

    const persistedModelId = computer?.chatRequestedModelId?.trim() || DEFAULT_MODEL_ID
    setSelectedModel(persistedModelId)
    setHasHydratedSelectedModel(true)
  }, [computer, hasHydratedSelectedModel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  const daysLeft = useMemo(() => {
    if (!computer?.pastDueAt) return null
    return Math.max(0, 7 - Math.floor((now - computer.pastDueAt) / (1000 * 60 * 60 * 24)))
  }, [computer?.pastDueAt, now])

  const errorMessage = error ? error.message : null
  const currentModel = AVAILABLE_MODELS.find((model) => model.id === selectedModel)
  const effectiveModelLabel =
    computer?.chatEffectiveProvider && computer?.chatEffectiveModel
      ? `${computer.chatEffectiveProvider}/${computer.chatEffectiveModel}`
      : computer?.chatRequestedModelRef || null
  const headerTitle = isWorkspaceFileView ? requestedFileName : activeSessionTitle || computer?.name || 'Computer'
  const workspaceFileType = isWorkspaceFileView ? getFileType(requestedFileName) : null
  const isEditableWorkspaceFile = isWorkspaceFileView && isEditableType(requestedFileName)
  const isMarkdownWorkspaceFile = workspaceFileType === 'markdown'
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const slashQuery = input.trimStart()
  const slashCommands = useMemo(() => (
    slashQuery.startsWith('/') ? getComputerCommandMenuItems(slashQuery) : []
  ), [slashQuery])
  const showSlashCommands = slashCommands.length > 0 && slashQuery.startsWith('/')

  const insertSlashCommand = useCallback((commandLabel: string) => {
    setInput(`${commandLabel} `)
    setActiveSlashIndex(0)
  }, [])

  const applyModelSelection = useCallback(
    async (modelId: string) => {
      setSelectedModel(modelId)
      setShowModelPicker(false)

      try {
        const response = await fetch('/api/app/computer-chat', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            computerId,
            modelId,
            sessionKey: activeSessionKey,
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error || 'Failed to update OpenClaw model.')
        }

        const payload = (await response.json()) as ModelUpdateResponse
        syncComputerRuntime(payload)

        await fetchComputer()
        await refreshSessions(payload.sessionKey)
        return payload
      } catch (error) {
        console.warn('[Computer Page] Failed to apply model selection:', {
          computerId,
          modelId,
          error: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    },
    [activeSessionKey, computerId, fetchComputer, refreshSessions, syncComputerRuntime]
  )

  const appendLocalCommandResult = useCallback((
    sessionKey: string,
    commandText: string,
    result: ComputerCommandResult,
    options?: { replace?: boolean }
  ) => {
    const commandId = crypto.randomUUID()
    const nextMessages: ComputerUiMessage[] = [
      {
        id: `command-user:${commandId}`,
        role: 'user',
        parts: [{ type: 'text', text: commandText }],
        metadata: {
          overlayKind: 'computer-command-user',
          commandId,
          sessionKey,
        },
      },
      {
        id: `command-result:${commandId}`,
        role: 'assistant',
        parts: [],
        metadata: {
          overlayKind: 'computer-command-result',
          commandId,
          sessionKey,
          result,
        },
      },
    ]

    setMessages((current) => (options?.replace ? nextMessages : [...current, ...nextMessages]))
  }, [setMessages])

  const executeComputerCommand = useCallback(async (
    commandText: string,
    currentSessionKey: string
  ) => {
    const parsedCommand = parseStandaloneComputerCommand(commandText)
    if (!parsedCommand) {
      return false
    }

    if (parsedCommand.descriptor.name === 'help' || parsedCommand.descriptor.name === 'commands') {
      appendLocalCommandResult(currentSessionKey, commandText, buildComputerCommandCatalogResult())
      setInput('')
      return true
    }

    if (parsedCommand.descriptor.name === 'new') {
      const nextModelId = resolveOverlayModelSelection(parsedCommand.args)
      const payload = await createNewSession(nextModelId || undefined)
      if (payload) {
        const nextLabel = nextModelId
          ? AVAILABLE_MODELS.find((model) => model.id === nextModelId)?.name || nextModelId
          : 'the current model'
        appendLocalCommandResult(
          payload.sessionKey,
          commandText,
          {
            kind: 'action',
            title: 'New Session',
            status: 'success',
            message: `Started a fresh session with ${nextLabel}.`,
          },
          { replace: true }
        )
      }
      setInput('')
      return true
    }

    if (
      parsedCommand.descriptor.name === 'model' &&
      parsedCommand.args &&
      !['list', 'status'].includes(parsedCommand.args.trim().toLowerCase())
    ) {
      const nextModelId = resolveOverlayModelSelection(parsedCommand.args)
      if (nextModelId) {
        const payload = await applyModelSelection(nextModelId)
        if (payload) {
          appendLocalCommandResult(currentSessionKey, commandText, {
            kind: 'action',
            title: 'Model Updated',
            status: 'success',
            message: `Session model changed to ${AVAILABLE_MODELS.find((model) => model.id === nextModelId)?.name || nextModelId}.`,
            fields: [
              { label: 'Requested', value: payload.requestedModelRef },
              { label: 'Effective', value: [payload.effectiveProvider, payload.effectiveModel].filter(Boolean).join('/') || 'Unknown' },
            ],
          })
        }
        setInput('')
        return true
      }
    }

    if (parsedCommand.descriptor.name === 'stop') {
      stop()
    }

    const response = await fetch('/api/app/computer-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        computerId,
        sessionKey: currentSessionKey,
        commandText,
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string
          result?: ComputerCommandResult
        }
      | null

    if (!response.ok || !payload?.result) {
      throw new Error(payload?.error || 'Failed to execute OpenClaw command.')
    }

    if (parsedCommand.descriptor.name === 'reset') {
      setHydratedTranscriptKey(null)
      appendLocalCommandResult(currentSessionKey, commandText, payload.result, { replace: true })
    } else {
      appendLocalCommandResult(currentSessionKey, commandText, payload.result)
    }

    await fetchComputer()
    await refreshSessions(currentSessionKey)
    setInput('')
    return true
  }, [
    appendLocalCommandResult,
    applyModelSelection,
    computerId,
    createNewSession,
    fetchComputer,
    refreshSessions,
    stop,
  ])

  const submitMessage = useCallback(async () => {
    const text = input.trim()
    const currentSessionKey = activeSessionKeyRef.current
    const currentModelId = selectedModelRef.current
    if (!text || isLoading || !currentSessionKey) return
    const isFirstMessageInSession = !messages.some(
      (message) => message.role === 'user' && !isLocalCommandMessage(message)
    )

    const parsedCommand = parseStandaloneComputerCommand(text)
    if (parsedCommand) {
      try {
        await executeComputerCommand(text, currentSessionKey)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute command.'
        appendLocalCommandResult(currentSessionKey, text, {
          kind: 'action',
          title: 'Command Error',
          status: 'error',
          message,
        })
        setInput('')
      }
      return
    }

    setInput('')
    setSessions((current) => {
      const existing = current.find((session) => session.key === currentSessionKey)
      if (!existing) return current
      return [
        { ...existing, updatedAt: Date.now() },
        ...current.filter((session) => session.key !== currentSessionKey),
      ]
    })
    dispatchComputerSessionsUpdated({
      computerId,
      type: 'updated',
      sessionKey: currentSessionKey,
    })
    await sendMessage(
      {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      {
        body: {
          computerId,
          modelId: currentModelId,
          sessionKey: currentSessionKey,
        },
      }
    )
    if (isFirstMessageInSession) {
      void generateTitle(text).then((title) => {
        if (!title) return
        void renameSession(currentSessionKey, title)
      })
    }
    await fetchComputer()
    await refreshSessions(currentSessionKey)
  }, [
    computerId,
    fetchComputer,
    input,
    isLoading,
    messages,
    refreshSessions,
    renameSession,
    sendMessage,
    appendLocalCommandResult,
    executeComputerCommand,
  ])

  useEffect(() => {
    if (!showSlashCommands) return

    const activeEntry = slashMenuRef.current?.querySelector<HTMLButtonElement>(
      `[data-command-index="${activeSlashIndex}"]`
    )
    activeEntry?.scrollIntoView({ block: 'nearest' })
  }, [activeSlashIndex, showSlashCommands])

  useEffect(() => {
    if (computer?.status !== 'ready') return

    console.log('[Computer Page] OpenClaw runtime:', {
      computerId: computer._id,
      name: computer.name,
      status: computer.status,
      ip: computer.hetznerServerIp ?? null,
      selectedModelId: selectedModel,
      selectedModelName: currentModel?.name ?? null,
      effectiveModel: effectiveModelLabel,
      chatSessionKey: computer.chatSessionKey ?? null,
      resolvedAt: computer.chatModelResolvedAt ?? null,
    })
  }, [
    computer?._id,
    computer?.chatModelResolvedAt,
    computer?.chatSessionKey,
    computer?.hetznerServerIp,
    computer?.name,
    computer?.status,
    currentModel?.name,
    effectiveModelLabel,
    selectedModel,
  ])

  if (computer === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#aaa]" />
      </div>
    )
  }

  if (computer === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[#aaa]">Computer not found.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e5e5] px-4">
        <h2 className="min-w-0 truncate text-sm font-medium text-[#0a0a0a]">{headerTitle}</h2>

        {computer.status === 'ready' && !isWorkspaceFileView && (
          <div className="flex items-center gap-2">
            <DelayedTooltip label="New chat session" side="bottom">
              <button
                type="button"
                onClick={() => void createNewSession()}
                disabled={isLoading || isCreatingSession}
                className="flex items-center justify-center rounded-md bg-[#f0f0f0] p-1.5 text-[#525252] transition-colors hover:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingSession ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              </button>
            </DelayedTooltip>

            <div className="relative">
              <DelayedTooltip label="Choose model (⇧⌘/)" side="bottom">
                <button
                  type="button"
                  onClick={() => setShowModelPicker((current) => !current)}
                  className="flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 py-1 text-xs text-[#525252] transition-colors hover:bg-[#e8e8e8]"
                >
                  {currentModel?.name || 'Select model'}
                  <ChevronDown size={11} />
                </button>
              </DelayedTooltip>
              {showModelPicker && (
                <div className="absolute right-0 top-full z-10 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        void applyModelSelection(model.id)
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[#f5f5f5] ${
                        model.id === selectedModel ? 'font-medium text-[#0a0a0a]' : 'text-[#525252]'
                      }`}
                    >
                      <span>{model.name}</span>
                      <span className="ml-2 text-[#aaa]">{model.provider}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {computer.status === 'ready' && isWorkspaceFileView && (
          <div className="flex items-center gap-2">
            {isEditableWorkspaceFile && isMarkdownWorkspaceFile && (
              <button
                onClick={() => setIsEditingMarkdownFile((current) => !current)}
                className="flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 py-1 text-xs text-[#525252] transition-colors hover:bg-[#e8e8e8]"
              >
                {isEditingMarkdownFile ? 'Preview' : 'Edit'}
              </button>
            )}
          </div>
        )}

        {computer.status === 'provisioning' && (
          <div className="flex items-center gap-2 text-xs text-[#f5a623]">
            <Loader2 size={11} className="animate-spin" />
            Setting up...
          </div>
        )}

        {computer.status === 'pending_payment' && (
          <div className="text-xs text-[#f5a623]">
            {justPaid ? 'Payment received - provisioning soon...' : 'Awaiting payment'}
          </div>
        )}
      </div>

      {(computer.status === 'pending_payment' || computer.status === 'provisioning') &&
        (computer.status === 'pending_payment' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <Loader2 size={24} className="animate-spin text-[#aaa]" />
            <p className="text-sm text-[#525252]">
              {justPaid
                ? 'Payment confirmed. Your server will start provisioning in a moment...'
                : 'Awaiting payment confirmation...'}
            </p>
            <p className="text-xs text-[#aaa]">This page will update automatically</p>
          </div>
        ) : (
          <ProvisioningView step={computer.provisioningStep} logs={logs} />
        ))}

      {computer.status === 'ready' && (
        <div className="flex min-h-0 flex-1 flex-col">
          {isWorkspaceFileView ? (
            <ComputerWorkspaceFileView
              key={requestedFileName}
              computerId={computerId}
              fileName={requestedFileName}
              isEditingMarkdown={isEditingMarkdownFile}
              onEditingMarkdownChange={setIsEditingMarkdownFile}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col bg-[#fbfbfb]">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {messages.length === 0 && !isLoading && (
                  <div className="rounded-2xl border border-dashed border-[#ddd] bg-white px-5 py-6 text-center">
                    <p className="text-sm text-[#444]">Your computer is ready.</p>
                    <p className="mt-1 text-xs text-[#888]">
                      Ask OpenClaw to inspect the machine, run setup steps, or help with tasks on the VPS.
                    </p>
                  </div>
                )}

                {messages.map((message) => {
                  const text = getMessageText(message)
                  const isAssistantStreaming = isLoading && message.id === lastMessage?.id && message.role === 'assistant'

                  if (isCommandResultMessage(message)) {
                    return (
                      <div key={message.id} className="flex justify-start message-appear">
                        <div className="w-full space-y-3">
                          <CommandResultCard result={message.metadata.result} />
                        </div>
                      </div>
                    )
                  }

                  if (isLocalCommandMessage(message) && message.role === 'user') {
                    return (
                      <div key={message.id} className="flex justify-end message-appear">
                        <CommandBubble command={text} />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex message-appear ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'user' ? (
                        <div className="max-w-[75%] space-y-2">
                          {text && (
                            <div className="chat-user-bubble rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm text-[#fafafa]">
                              <span className="whitespace-pre-wrap">{text}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full space-y-2">
                          {text && (
                            <div className="w-full px-1 py-1 text-sm leading-relaxed text-[#0a0a0a]">
                              <MarkdownMessage
                                text={text}
                                isStreaming={isAssistantStreaming}
                                suppressTypingIndicator
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {showLoadingIndicator && (
                  <div className="flex items-center px-1 py-2 min-h-7" aria-live="polite" aria-busy="true">
                    <div className="md-typing-indicator" aria-label="Response loading">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      <AlertCircle size={12} />
                      {errorMessage}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="px-4 pb-4">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="relative">
                    {showSlashCommands && (
                      <div
                        ref={slashMenuRef}
                        className="absolute bottom-full left-0 right-0 z-10 mb-2 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white p-1 shadow-lg"
                        style={{ maxHeight: '205px' }}
                      >
                        {slashCommands.map((entry, index) => (
                          <button
                            key={entry.name}
                            type="button"
                            data-command-index={index}
                            onClick={() => insertSlashCommand(getComputerCommandLabel(entry))}
                            className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left transition-colors ${
                              index === activeSlashIndex ? 'bg-[#f5f5f5]' : 'hover:bg-[#fafafa]'
                            }`}
                          >
                            <span className="whitespace-nowrap text-xs font-medium text-[#0a0a0a]">
                              {getComputerCommandLabel(entry)}
                            </span>
                            <span className="min-w-0 truncate text-right text-[11px] text-[#8a8a8a]">
                              {entry.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 rounded-2xl bg-[#f0f0f0] px-4 py-2.5">
                      <DelayedTooltip
                        className="min-w-0 flex-1"
                        label="Slash commands (/) · focus from elsewhere (/)"
                        side="bottom"
                      >
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(event) => {
                            setInput(event.target.value)
                            setActiveSlashIndex(0)
                          }}
                          placeholder="Ask the computer to do something or type / for OpenClaw commands..."
                          rows={1}
                          onKeyDown={(event) => {
                            if (showSlashCommands && event.key === 'ArrowDown') {
                              event.preventDefault()
                              setActiveSlashIndex((current) => (current + 1) % slashCommands.length)
                              return
                            }

                            if (showSlashCommands && event.key === 'ArrowUp') {
                              event.preventDefault()
                              setActiveSlashIndex((current) => (current - 1 + slashCommands.length) % slashCommands.length)
                              return
                            }

                            if (showSlashCommands && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))) {
                              event.preventDefault()
                              const activeCommand = slashCommands[activeSlashIndex]
                              if (activeCommand) {
                                insertSlashCommand(getComputerCommandLabel(activeCommand))
                              }
                              return
                            }

                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              void submitMessage()
                            }
                          }}
                          className="w-full min-w-0 resize-none bg-transparent py-1.5 text-sm leading-6 text-[#0a0a0a] outline-none placeholder:text-[#aaa]"
                        />
                      </DelayedTooltip>
                      {isLoading ? (
                        <DelayedTooltip label="Stop generating (/stop)" side="top">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeSessionKey) {
                                void executeComputerCommand('/stop', activeSessionKey)
                              }
                            }}
                            className="shrink-0 rounded-lg bg-[#0a0a0a] p-1.5 text-[#fafafa] transition-colors hover:bg-[#333]"
                          >
                            <div className="h-3.5 w-3.5 rounded-sm bg-[#fafafa]" />
                          </button>
                        </DelayedTooltip>
                      ) : (
                        <DelayedTooltip label="Send (↵) · new line (⇧↵)" side="top">
                          <button
                            type="button"
                            onClick={() => void submitMessage()}
                            disabled={!input.trim() || !activeSessionKey}
                            className="shrink-0 rounded-lg bg-[#0a0a0a] p-1.5 text-[#fafafa] transition-colors hover:bg-[#333] disabled:opacity-40"
                          >
                            <Send size={14} />
                          </button>
                        </DelayedTooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {computer.status === 'past_due' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle size={32} className="text-[#e74c3c]" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#0a0a0a]">Payment failed</p>
            <p className="text-xs text-[#888]">
              {daysLeft !== null
                ? `Your computer will be deleted in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
                : 'Your computer will be deleted soon.'}
            </p>
          </div>
          <a
            href="https://billing.stripe.com/p/login/test_00g00000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#0a0a0a] underline underline-offset-2"
          >
            Update payment method ↗
          </a>
        </div>
      )}

      {computer.status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertCircle size={32} className="text-[#e74c3c]" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#0a0a0a]">Setup failed</p>
            <p className="text-xs text-[#888]">
              {computer.errorMessage ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <p className="text-xs text-[#aaa]">Please contact support or delete and recreate.</p>
        </div>
      )}

      {computer.status === 'deleted' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-[#aaa]">This computer has been deleted.</p>
        </div>
      )}
    </div>
  )
}
