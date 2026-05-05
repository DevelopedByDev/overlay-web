'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { BookOpen, FolderOpen, Loader2, MessageSquare, Pencil } from 'lucide-react'
import { CHAT_CREATED_EVENT, CHAT_TITLE_UPDATED_EVENT, type ChatCreatedDetail, type ChatTitleUpdatedDetail } from '@/lib/chat-title'

const PROJECT_META_UPDATED_EVENT = 'overlay:project-meta-updated'

type HubChat = { _id: string; title: string }
type HubNote = { _id: string; title?: string }
type CanonicalNoteFile = { _id: string; name?: string; textContent?: string; content?: string }
type ProjectFileRecord = {
  _id: string
  name: string
  content?: string
  textContent?: string
  mimeType?: string
  extension?: string
  kind?: 'folder' | 'note' | 'upload' | 'output'
}

function opensInDocumentEditor(file: ProjectFileRecord): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
}
import { FileViewerSkeleton } from '@/components/ui/Skeleton'
import ChatInterface from './ChatInterface'
import NotebookEditor from './NotebookEditor'
import { FileViewerPanel, isEditableType } from './FileViewer'

// ─── File viewer fetched by ID ────────────────────────────────────────────────

function ProjectFileView({ fileId }: { fileId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [file, setFile] = useState<ProjectFileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileContent, setFileContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      setLoading(true)
      fetch(`/api/app/files?fileId=${fileId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (opensInDocumentEditor(data)) {
            const p = new URLSearchParams(searchParams?.toString() ?? '')
            p.set('view', 'note')
            p.set('id', fileId)
            router.replace(`/app/projects?${p.toString()}`)
            return
          }
          setFile(data)
          setFileContent(data.textContent ?? data.content ?? '')
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [fileId, router, searchParams])

  function handleContentChange(val: string) {
    setFileContent(val)
    if (!file) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true)
      await fetch('/api/app/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, textContent: val }),
      })
      setIsSaving(false)
    }, 800)
  }

  if (loading) {
    return <FileViewerSkeleton />
  }
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#aaa] text-sm">
        File not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FileViewerPanel
        name={file.name}
        content={fileContent}
        isSaving={isSaving}
        isEditable={isEditableType(file.name)}
        onContentChange={handleContentChange}
      />
    </div>
  )
}

function ProjectHub({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [creating, setCreating] = useState<'chat' | 'note' | null>(null)
  const [chats, setChats] = useState<HubChat[]>([])
  const [notes, setNotes] = useState<HubNote[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    setDraftName(projectName)
  }, [projectName])

  const loadHubItems = useCallback(async () => {
    setListsLoading(true)
    try {
      const q = encodeURIComponent(projectId)
      const [chatsRes, notesRes] = await Promise.all([
        fetch(`/api/app/conversations?projectId=${q}`),
        fetch(`/api/app/files?kind=note&projectId=${q}`),
      ])
      const [chatsJson, notesJson] = await Promise.all([
        chatsRes.ok ? chatsRes.json() : [],
        notesRes.ok ? notesRes.json() : [],
      ])
      setChats(Array.isArray(chatsJson) ? chatsJson : [])
      setNotes(Array.isArray(notesJson) ? notesJson.map((file: CanonicalNoteFile) => ({
        _id: file._id,
        title: file.name || 'Untitled',
      })) : [])
    } finally {
      setListsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadHubItems()
  }, [loadHubItems])

  useEffect(() => {
    function onChatCreated(e: Event) {
      const { detail } = e as CustomEvent<ChatCreatedDetail>
      if (!detail?.chat?._id) return
      void loadHubItems()
    }
    function onTitleUpdated(e: Event) {
      const { detail } = e as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId) return
      setChats((prev) =>
        prev.map((c) => (c._id === detail.chatId ? { ...c, title: detail.title } : c)),
      )
    }
    function onProjectMeta(e: Event) {
      const d = (e as CustomEvent<{ projectId?: string; name?: string }>).detail
      if (d?.projectId !== projectId || !d.name) return
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('projectName', d.name)
      router.replace(`${pathname}?${params}`)
      setDraftName(d.name)
    }
    window.addEventListener(CHAT_CREATED_EVENT, onChatCreated)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
    window.addEventListener(PROJECT_META_UPDATED_EVENT, onProjectMeta)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, onChatCreated)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
      window.removeEventListener(PROJECT_META_UPDATED_EVENT, onProjectMeta)
    }
  }, [loadHubItems, pathname, projectId, router, searchParams])

  async function commitProjectRename() {
    setEditingName(false)
    const name = draftName.trim()
    if (!name || name === projectName) {
      setDraftName(projectName)
      return
    }
    setSavingName(true)
    try {
      const res = await fetch('/api/app/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name }),
      })
      if (!res.ok) {
        setDraftName(projectName)
        return
      }
      const data = (await res.json().catch(() => ({}))) as { project?: { name?: string } }
      const finalName = data.project?.name?.trim() || name
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('projectName', finalName)
      router.replace(`${pathname}?${params}`)
      window.dispatchEvent(
        new CustomEvent(PROJECT_META_UPDATED_EVENT, { detail: { projectId, name: finalName } }),
      )
      setDraftName(finalName)
    } finally {
      setSavingName(false)
    }
  }

  async function createChat() {
    if (creating) return
    setCreating('chat')
    try {
      const res = await fetch('/api/app/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: 'New Chat' }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { id?: string }
      const cid = data.id
      if (!cid) return
      void loadHubItems()
      router.push(
        `/app/projects?view=chat&id=${encodeURIComponent(cid)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
      )
    } finally {
      setCreating(null)
    }
  }

  async function createNote() {
    if (creating) return
    setCreating('note')
    try {
      const res = await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, kind: 'note', name: 'Untitled', textContent: '' }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { id?: string }
      const nid = data.id
      if (!nid) return
      void loadHubItems()
      router.push(
        `/app/projects?view=note&id=${encodeURIComponent(nid)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
      )
    } finally {
      setCreating(null)
    }
  }

  function openChat(id: string) {
    router.push(
      `/app/projects?view=chat&id=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }

  function openNote(id: string) {
    router.push(
      `/app/projects?view=note&id=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }

  const headerBtnClass =
    'inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:pointer-events-none disabled:opacity-50'

  const rowClass =
    'flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-subtle)]'

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-6">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="group/project-head min-w-0 flex-1">
            {editingName ? (
              <input
                className="w-full max-w-md rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                value={draftName}
                disabled={savingName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void commitProjectRename()
                  }
                  if (e.key === 'Escape') {
                    setDraftName(projectName)
                    setEditingName(false)
                  }
                }}
                onBlur={() => void commitProjectRename()}
                autoFocus
              />
            ) : (
              <div className="flex min-w-0 items-center gap-1">
                <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)]">
                  {projectName || 'Project'}
                </h1>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/project-head:opacity-100 focus-visible:opacity-100"
                  aria-label="Rename project"
                  onClick={() => {
                    setDraftName(projectName)
                    setEditingName(true)
                  }}
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <p className="truncate text-[11px] text-[var(--muted-light)]">Project workspace</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button type="button" className={headerBtnClass} onClick={() => void createChat()} disabled={creating !== null}>
            {creating === 'chat' ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            New chat
          </button>
          <button type="button" className={headerBtnClass} onClick={() => void createNote()} disabled={creating !== null}>
            {creating === 'note' ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
            New note
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {listsLoading ? (
          <div className="flex justify-center py-12 text-sm text-[var(--muted)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-light)]">Chats</h2>
              {chats.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No chats yet.</p>
              ) : (
                <ul className="space-y-1">
                  {chats.map((c) => (
                    <li key={c._id}>
                      <button type="button" className={`${rowClass} w-full`} onClick={() => openChat(c._id)}>
                        <MessageSquare size={14} className="shrink-0 text-[var(--muted-light)]" />
                        <span className="min-w-0 truncate">{c.title || 'Untitled'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-light)]">Notes</h2>
              {notes.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No notes yet.</p>
              ) : (
                <ul className="space-y-1">
                  {notes.map((n) => (
                    <li key={n._id}>
                      <button type="button" className={`${rowClass} w-full`} onClick={() => openNote(n._id)}>
                        <BookOpen size={14} className="shrink-0 text-[var(--muted-light)]" />
                        <span className="min-w-0 truncate">{n.title || 'Untitled'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView({ userId, firstName }: { userId: string; firstName?: string }) {
  const searchParams = useSearchParams()
  const view = searchParams?.get('view') ?? null
  const id = searchParams?.get('id') ?? null
  const projectName = searchParams?.get('projectName') ?? undefined
  const projectId = searchParams?.get('projectId') ?? null

  if (view === 'chat' && id) {
    return (
      <ChatInterface userId={userId} firstName={firstName} hideSidebar projectName={projectName} />
    )
  }

  if (view === 'note' && id) {
    return <NotebookEditor userId={userId} hideSidebar projectName={projectName} />
  }

  if (view === 'file' && id) {
    return <ProjectFileView fileId={id} />
  }

  if (projectId?.trim()) {
    return (
      <ProjectHub
        projectId={projectId.trim()}
        projectName={projectName?.trim() || 'Project'}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
      <FolderOpen size={40} strokeWidth={1} className="opacity-30" />
      <p className="text-sm">Select a project to get started</p>
    </div>
  )
}
