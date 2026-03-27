'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Plus,
  Cpu,
  Circle,
  Trash2,
  Loader2,
  ChevronRight,
  FolderOpen,
  FileText,
  MessageSquare,
} from 'lucide-react'

type ComputerStatus = 'pending_payment' | 'provisioning' | 'ready' | 'past_due' | 'error' | 'deleted'

interface ComputerItem {
  _id: string
  name: string
  status: ComputerStatus
}

interface WorkspaceFileItem {
  name: string
  path: string
  missing: boolean
  updatedAtMs?: number
}

interface SessionItem {
  key: string
  title: string
  updatedAt: number | null
}

interface ComputerTreeData {
  activeSessionKey: string | null
  files: WorkspaceFileItem[]
  sessions: SessionItem[]
  workspaceUnavailableReason: string | null
}

interface ComputerSessionsEventDetail {
  computerId?: string
  type?: 'created' | 'updated' | 'deleted'
  sessionKey?: string
  deletedSessionKey?: string
  title?: string
}

const STATUS_COLORS: Record<ComputerStatus, string> = {
  pending_payment: 'text-[#f5a623]',
  provisioning: 'text-[#f5a623]',
  ready: 'text-[#27ae60]',
  past_due: 'text-[#e74c3c]',
  error: 'text-[#e74c3c]',
  deleted: 'text-[#bbb]',
}

function StatusDot({ status }: { status: ComputerStatus }) {
  return <Circle size={6} className={`shrink-0 fill-current ${STATUS_COLORS[status]}`} />
}

function shouldSuppressWorkspaceWarning(reason: string | null): boolean {
  if (!reason) return false
  const lower = reason.toLowerCase()
  return lower.includes('operator.read') || lower.includes('denied read access')
}

function buildComputerHref(computerId: string, params?: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const query = search.toString()
  return query ? `/app/computer/${computerId}?${query}` : `/app/computer/${computerId}`
}

function TreeRow({
  depth,
  active,
  onClick,
  icon,
  title,
  trailing,
  muted,
}: {
  depth: number
  active?: boolean
  onClick?: () => void
  icon: React.ReactNode
  title: string
  trailing?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-1.5 py-1 rounded-md text-xs transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? 'bg-[#e8e8e8] text-[#0a0a0a]'
          : muted
            ? 'text-[#9a9a9a]'
            : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
    >
      {icon}
      <span className="flex-1 truncate">{title}</span>
      {trailing}
    </div>
  )
}

function ComputerNode({
  computer,
  pathname,
  searchParams,
  deleting,
  isOpen,
  onToggle,
  onDelete,
}: {
  computer: ComputerItem
  pathname: string
  searchParams: ReturnType<typeof useSearchParams>
  deleting: boolean
  isOpen: boolean
  onToggle: (computerId: string, event: React.MouseEvent) => void
  onDelete: (computerId: string, computerName: string, event: React.MouseEvent) => void
}) {
  const router = useRouter()
  const [details, setDetails] = useState<ComputerTreeData>({
    activeSessionKey: null,
    files: [],
    sessions: [],
    workspaceUnavailableReason: null,
  })
  const [hasLoadedDetails, setHasLoadedDetails] = useState(false)
  const [loadingInitialDetails, setLoadingInitialDetails] = useState(false)
  const [deletingSessionKey, setDeletingSessionKey] = useState<string | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [sessionsOpen, setSessionsOpen] = useState(true)

  const isComputerRoute = pathname === `/app/computer/${computer._id}`
  const currentView = searchParams?.get('view') ?? null
  const currentFile = searchParams?.get('file') ?? null
  const currentSessionKey = searchParams?.get('sessionKey') ?? null
  const activeSessionKey = currentSessionKey || details.activeSessionKey || null
  const computerRowActive = isComputerRoute && !currentView && !activeSessionKey
  const visibleWorkspaceWarning = shouldSuppressWorkspaceWarning(details.workspaceUnavailableReason)
    ? null
    : details.workspaceUnavailableReason

  const refreshWorkspace = useCallback(async () => {
    const response = await fetch(`/api/app/computer-workspace?computerId=${computer._id}`)
    const payload = response.ok ? await response.json() : null
    setDetails((current) => ({
      ...current,
      files: Array.isArray(payload?.files) ? payload.files : [],
      workspaceUnavailableReason:
        typeof payload?.unavailableReason === 'string' && payload.unavailableReason.trim()
          ? payload.unavailableReason.trim()
          : null,
    }))
  }, [computer._id])

  const refreshSessions = useCallback(async () => {
    const response = await fetch(`/api/app/computer-sessions?computerId=${computer._id}`)
    const payload = response.ok ? await response.json() : null
    setDetails((current) => ({
      ...current,
      activeSessionKey:
        typeof payload?.activeSessionKey === 'string'
          ? payload.activeSessionKey
          : current.activeSessionKey,
      sessions: Array.isArray(payload?.sessions) ? payload.sessions : current.sessions,
    }))
  }, [computer._id])

  useEffect(() => {
    if (!isOpen) return
    const isInitialLoad = !hasLoadedDetails
    if (isInitialLoad) {
      setLoadingInitialDetails(true)
    }

    void Promise.all([refreshWorkspace(), refreshSessions()]).finally(() => {
      setHasLoadedDetails(true)
      if (isInitialLoad) {
        setLoadingInitialDetails(false)
      }
    })
  }, [hasLoadedDetails, isOpen, refreshSessions, refreshWorkspace])

  useEffect(() => {
    if (!isOpen) return
    if (computer.status !== 'ready') return
    void Promise.all([refreshWorkspace(), refreshSessions()])
  }, [computer.status, isOpen, refreshSessions, refreshWorkspace])

  useEffect(() => {
    if (!isOpen) return

    function handleWorkspaceUpdate(event: Event) {
      const detail = (event as CustomEvent<{ computerId?: string }>).detail
      if (detail?.computerId === computer._id) {
        void refreshWorkspace()
      }
    }

    function handleSessionsUpdate(event: Event) {
      const detail = (event as CustomEvent<ComputerSessionsEventDetail>).detail
      if (detail?.computerId === computer._id) {
        void refreshSessions()
      }
    }

    window.addEventListener('overlay:computer-workspace-updated', handleWorkspaceUpdate)
    window.addEventListener('overlay:computer-sessions-updated', handleSessionsUpdate)
    return () => {
      window.removeEventListener('overlay:computer-workspace-updated', handleWorkspaceUpdate)
      window.removeEventListener('overlay:computer-sessions-updated', handleSessionsUpdate)
    }
  }, [computer._id, isOpen, refreshSessions, refreshWorkspace])

  const handleDeleteSession = useCallback(async (session: SessionItem, event: React.MouseEvent) => {
    event.stopPropagation()

    if (deletingSessionKey) return

    const confirmed = window.confirm(
      `Delete chat "${session.title}"?\n\nThis deletes the session entry and archives its transcript.`
    )
    if (!confirmed) return

    setDeletingSessionKey(session.key)
    try {
      const response = await fetch(
        `/api/app/computer-sessions?computerId=${computer._id}&sessionKey=${encodeURIComponent(session.key)}`,
        { method: 'DELETE' }
      )

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string
            sessionKey?: string | null
            deletedSessionKey?: string
          }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete chat')
      }

      const nextSessionKey = payload?.sessionKey?.trim() || null

      setDetails((current) => ({
        ...current,
        activeSessionKey: nextSessionKey,
        sessions: current.sessions.filter((entry) => entry.key !== session.key),
      }))

      window.dispatchEvent(
        new CustomEvent<ComputerSessionsEventDetail>('overlay:computer-sessions-updated', {
          detail: {
            computerId: computer._id,
            type: 'deleted',
            sessionKey: nextSessionKey ?? undefined,
            deletedSessionKey: session.key,
          },
        })
      )

      if (isComputerRoute && currentSessionKey === session.key) {
        if (nextSessionKey) {
          router.replace(
            buildComputerHref(computer._id, {
              view: 'session',
              sessionKey: nextSessionKey,
            })
          )
        } else {
          router.replace(buildComputerHref(computer._id))
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete chat'
      window.alert(message)
    } finally {
      setDeletingSessionKey((current) => (current === session.key ? null : current))
    }
  }, [computer._id, currentSessionKey, deletingSessionKey, isComputerRoute, router])

  return (
    <div>
      <div
        onClick={() => router.push(buildComputerHref(computer._id))}
        className={`group flex items-center gap-1.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
          computerRowActive
            ? 'bg-[#e8e8e8] text-[#0a0a0a]'
            : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: '8px', paddingRight: '8px' }}
      >
        <button
          onClick={(event) => onToggle(computer._id, event)}
          className="shrink-0 p-0.5 rounded hover:bg-[#d8d8d8] transition-colors"
        >
          <ChevronRight size={10} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        <Cpu size={12} className="shrink-0 text-[#888]" />
        <span className="flex-1 truncate">{computer.name}</span>
        <button
          onClick={(event) => onDelete(computer._id, computer.name, event)}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0 disabled:opacity-100 disabled:cursor-wait"
          aria-label={`Delete ${computer.name}`}
          title={`Delete ${computer.name}`}
        >
          {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} className="text-[#c33]" />}
        </button>
        <StatusDot status={computer.status} />
      </div>

      {isOpen && (
        <>
          <TreeRow
            depth={1}
            onClick={() => setWorkspaceOpen((current) => !current)}
            icon={
              <>
                <ChevronRight size={10} className={`transition-transform ${workspaceOpen ? 'rotate-90' : ''}`} />
                <FolderOpen size={11} className="shrink-0 text-[#888]" />
              </>
            }
            title="workspace"
            muted
          />

          {loadingInitialDetails && !hasLoadedDetails && (
            <div className="flex items-center py-1" style={{ paddingLeft: `${2 * 16 + 8}px` }}>
              <Loader2 size={10} className="animate-spin text-[#bbb]" />
            </div>
          )}

          {hasLoadedDetails && workspaceOpen && details.files.map((file) => {
            const active = isComputerRoute && currentView === 'file' && currentFile === file.name
            return (
              <TreeRow
                key={file.name}
                depth={2}
                active={active}
                onClick={() =>
                  router.push(
                    buildComputerHref(computer._id, {
                      view: 'file',
                      file: file.name,
                    })
                  )
                }
                icon={<FileText size={10} className="shrink-0 text-[#aaa]" />}
                title={file.name}
                muted={file.missing}
              />
            )
          })}

          {hasLoadedDetails && workspaceOpen && Boolean(visibleWorkspaceWarning) && (
            <p
              className="py-1 text-[10px] text-[#c08a00]"
              style={{ paddingLeft: `${2 * 16 + 18}px` }}
            >
              Workspace unavailable: {visibleWorkspaceWarning}
            </p>
          )}

          {hasLoadedDetails && workspaceOpen && !visibleWorkspaceWarning && details.files.length === 0 && (
            <p
              className="py-1 text-[10px] text-[#bbb]"
              style={{ paddingLeft: `${2 * 16 + 18}px` }}
            >
              No files yet
            </p>
          )}

          {hasLoadedDetails && (
            <>
              <TreeRow
                depth={1}
                onClick={() => setSessionsOpen((current) => !current)}
                icon={
                  <>
                    <ChevronRight size={10} className={`transition-transform ${sessionsOpen ? 'rotate-90' : ''}`} />
                    <FolderOpen size={11} className="shrink-0 text-[#888]" />
                  </>
                }
                title="sessions"
                muted
              />

              {sessionsOpen && details.sessions.map((session) => {
                const active = Boolean(
                  isComputerRoute &&
                  (currentView === 'session' || currentSessionKey || (!currentView && activeSessionKey)) &&
                  activeSessionKey === session.key
                )

                return (
                  <TreeRow
                    key={session.key}
                    depth={2}
                    active={active}
                    onClick={() =>
                      router.push(
                        buildComputerHref(computer._id, {
                          view: 'session',
                          sessionKey: session.key,
                        })
                      )
                    }
                    icon={<MessageSquare size={10} className="shrink-0 text-[#aaa]" />}
                    title={session.title}
                    trailing={
                      <button
                        onClick={(event) => void handleDeleteSession(session, event)}
                        disabled={deletingSessionKey === session.key}
                        className="rounded p-0.5 text-[#b0b0b0] transition-colors hover:bg-[#d8d8d8] hover:text-[#c33] disabled:cursor-wait disabled:text-[#c33]"
                        aria-label={`Delete ${session.title}`}
                        title={`Delete ${session.title}`}
                      >
                        {deletingSessionKey === session.key ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
                      </button>
                    }
                  />
                )
              })}

              {sessionsOpen && details.sessions.length === 0 && (
                <p
                  className="py-1 text-[10px] text-[#bbb]"
                  style={{ paddingLeft: `${2 * 16 + 18}px` }}
                >
                  No chats yet
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ComputerSidebar() {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const [computers, setComputers] = useState<ComputerItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const inFlightFetchRef = useRef<Promise<ComputerItem[] | null> | null>(null)

  const fetchComputers = useCallback(async () => {
    if (inFlightFetchRef.current) {
      return await inFlightFetchRef.current
    }

    const nextRequest = fetch('/api/app/computers', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        const payload = await response.json() as { computers?: ComputerItem[] }
        const result = Array.isArray(payload.computers) ? payload.computers : []
        setComputers(result)
        return result
      })
      .finally(() => {
        inFlightFetchRef.current = null
      })

    inFlightFetchRef.current = nextRequest
    return await nextRequest
  }, [])

  const handleDeleteComputer = useCallback(async (computerId: string, computerName: string, event: React.MouseEvent) => {
    event.stopPropagation()

    if (deletingId) return

    const confirmed = window.confirm(
      `Delete "${computerName}"?\n\nThis will delete its Hetzner server, firewall, and all associated Overlay records.`
    )
    if (!confirmed) return

    setDeletingId(computerId)
    try {
      const response = await fetch(`/api/app/computers/${computerId}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({} as { error?: string }))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete computer')
      }

      setComputers((prev) => prev.filter((computer) => computer._id !== computerId))
      window.dispatchEvent(
        new CustomEvent('overlay:computers-updated', {
          detail: {
            computerId,
            type: 'deleted',
          },
        })
      )

      if (pathname === `/app/computer/${computerId}`) {
        router.replace('/app/computer')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete computer'
      if (message === 'Computer not found') {
        setComputers((prev) => prev.filter((computer) => computer._id !== computerId))
        window.dispatchEvent(
          new CustomEvent('overlay:computers-updated', {
            detail: {
              computerId,
              type: 'deleted',
            },
          })
        )
        if (pathname === `/app/computer/${computerId}`) {
          router.replace('/app/computer')
        }
        return
      }
      window.alert(message)
    } finally {
      setDeletingId((current) => (current === computerId ? null : current))
    }
  }, [deletingId, pathname, router])

  const handleToggleComputer = useCallback((computerId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(computerId)) {
        next.delete(computerId)
      } else {
        next.add(computerId)
      }
      return next
    })
  }, [])

  useEffect(() => {
    void fetchComputers()
  }, [fetchComputers])

  useEffect(() => {
    function refreshInBackground() {
      void fetchComputers()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshInBackground()
      }
    }

    window.addEventListener('focus', refreshInBackground)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('overlay:computers-updated', refreshInBackground)
    return () => {
      window.removeEventListener('focus', refreshInBackground)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('overlay:computers-updated', refreshInBackground)
    }
  }, [fetchComputers])

  useEffect(() => {
    const match = pathname.match(/^\/app\/computer\/([^/]+)/)
    const computerId = match?.[1]
    if (!computerId) return
    setExpandedIds((prev) => {
      if (prev.has(computerId)) return prev
      const next = new Set(prev)
      next.add(computerId)
      return next
    })
  }, [pathname, searchParams])

  return (
    <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3 shrink-0">
        <button
          onClick={() => router.push('/app/computer/new')}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
        >
          <Plus size={13} />
          New Computer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {computers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#aaa] text-center">
            <Cpu size={24} strokeWidth={1} className="opacity-40" />
            <p className="text-xs">No computers yet</p>
            <p className="text-[10px]">Click &quot;New Computer&quot; to add one</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {computers.map((computer) => (
              <ComputerNode
                key={computer._id}
                computer={computer}
                pathname={pathname}
                searchParams={searchParams}
                deleting={deletingId === computer._id}
                isOpen={expandedIds.has(computer._id)}
                onToggle={handleToggleComputer}
                onDelete={handleDeleteComputer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
