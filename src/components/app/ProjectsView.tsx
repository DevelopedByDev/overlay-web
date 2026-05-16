'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  BookOpen,
  ChevronDown,
  FileText,
  FolderOpen,
  FolderPlus,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  type ChatCreatedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'

const PROJECT_META_UPDATED_EVENT = 'overlay:project-meta-updated'
const PROJECTS_CHANGED_EVENT = 'overlay:projects-changed'
const FILES_CHANGED_EVENT = 'overlay:files-changed'

type HubChat = { _id: string; title: string; updatedAt?: number }
type ProjectFileRecord = {
  _id: string
  name: string
  shareVisibility?: 'private' | 'public'
  shareToken?: string | null
  content?: string
  textContent?: string
  mimeType?: string
  extension?: string
  kind?: 'folder' | 'note' | 'upload' | 'output'
  updatedAt?: number
}

function opensInDocumentEditor(file: ProjectFileRecord): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
}

import { FileViewerSkeleton } from '@/components/ui/Skeleton'
import dynamic from 'next/dynamic'
import { FileViewerPanel, isEditableType } from './FileViewer'
import { FileShareMenu } from './FileShareMenu'
import { buildSharePageUrl } from '@/lib/share-url'

const ChatInterface = dynamic(() => import('./ChatInterface'))
const NotebookEditor = dynamic(() => import('./NotebookEditor'))

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
        headerRight={
          <FileShareMenu
            fileId={file._id}
            title={file.name}
            initialShareVisibility={file.shareVisibility ?? 'private'}
            initialShareUrl={
              file.shareVisibility === 'public' && file.shareToken
                ? buildSharePageUrl('file', file.shareToken)
                : null
            }
          />
        }
      />
    </div>
  )
}

// ─── Project hub: ChatInterface + Chats / Files / Instructions tabs ──────────

type HubTab = 'chats' | 'files' | 'instructions'

function ProjectHubBody({
  projectId,
  projectName,
  userId,
  firstName,
}: {
  projectId: string
  projectName: string
  userId: string
  firstName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<HubTab>('chats')
  const [chats, setChats] = useState<HubChat[]>([])
  const [files, setFiles] = useState<ProjectFileRecord[]>([])
  const [listsLoading, setListsLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const [savingName, setSavingName] = useState(false)
  useEffect(() => { setDraftName(projectName) }, [projectName])

  const [instructions, setInstructions] = useState<string>('')
  const [instructionsLoaded, setInstructionsLoaded] = useState(false)
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [instructionsSavedAt, setInstructionsSavedAt] = useState<number | null>(null)
  const instructionsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load project instructions
  useEffect(() => {
    let cancelled = false
    setInstructionsLoaded(false)
    fetch(`/api/app/projects?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { instructions?: string } | null) => {
        if (cancelled) return
        setInstructions((data?.instructions ?? '') as string)
        setInstructionsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setInstructionsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const loadHubItems = useCallback(async () => {
    setListsLoading(true)
    try {
      const q = encodeURIComponent(projectId)
      const [chatsRes, filesRes] = await Promise.all([
        fetch(`/api/app/conversations?projectId=${q}`),
        fetch(`/api/app/files?projectId=${q}`),
      ])
      const [chatsJson, filesJson] = await Promise.all([
        chatsRes.ok ? chatsRes.json() : [],
        filesRes.ok ? filesRes.json() : [],
      ])
      setChats(Array.isArray(chatsJson) ? chatsJson : [])
      setFiles(Array.isArray(filesJson) ? filesJson : [])
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
    function onChatDeleted(e: Event) {
      const { detail } = e as CustomEvent<ChatDeletedDetail>
      if (!detail?.chatId) return
      setChats((prev) => prev.filter((c) => c._id !== detail.chatId))
    }
    function onTitleUpdated(e: Event) {
      const { detail } = e as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId) return
      setChats((prev) =>
        prev.map((c) => (c._id === detail.chatId ? { ...c, title: detail.title } : c)),
      )
    }
    function onFilesChanged() {
      void loadHubItems()
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
    window.addEventListener(CHAT_DELETED_EVENT, onChatDeleted)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
    window.addEventListener(FILES_CHANGED_EVENT, onFilesChanged)
    window.addEventListener(PROJECT_META_UPDATED_EVENT, onProjectMeta)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, onChatCreated)
      window.removeEventListener(CHAT_DELETED_EVENT, onChatDeleted)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, onTitleUpdated)
      window.removeEventListener(FILES_CHANGED_EVENT, onFilesChanged)
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
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
      setDraftName(finalName)
    } finally {
      setSavingName(false)
    }
  }

  async function createChat() {
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, title: 'New Chat' }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { id?: string }
    if (!data.id) return
    void loadHubItems()
    router.push(
      `/app/projects?view=chat&id=${encodeURIComponent(data.id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }

  async function createNote() {
    const res = await fetch('/api/app/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, kind: 'note', name: 'Untitled', textContent: '' }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { id?: string }
    if (!data.id) return
    void loadHubItems()
    router.push(
      `/app/projects?view=note&id=${encodeURIComponent(data.id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }

  function openChat(id: string) {
    router.push(
      `/app/projects?view=chat&id=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }
  function openFile(file: ProjectFileRecord) {
    const view = opensInDocumentEditor(file) ? 'note' : 'file'
    router.push(
      `/app/projects?view=${view}&id=${encodeURIComponent(file._id)}&projectId=${encodeURIComponent(projectId)}&projectName=${encodeURIComponent(projectName)}`,
    )
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadFiles(filesIn: FileList | null) {
    if (!filesIn || filesIn.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(filesIn)) {
        const form = new FormData()
        form.append('file', file)
        form.append('projectId', projectId)
        await fetch('/api/app/files/ingest-document', { method: 'POST', body: form }).catch(() => null)
      }
      window.dispatchEvent(new Event(FILES_CHANGED_EVENT))
      void loadHubItems()
    } finally {
      setUploading(false)
    }
  }

  function onInstructionsChange(val: string) {
    setInstructions(val)
    if (instructionsSaveTimer.current) clearTimeout(instructionsSaveTimer.current)
    instructionsSaveTimer.current = setTimeout(async () => {
      setSavingInstructions(true)
      try {
        const res = await fetch('/api/app/projects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, instructions: val }),
        })
        if (res.ok) setInstructionsSavedAt(Date.now())
      } finally {
        setSavingInstructions(false)
      }
    }, 700)
  }

  // Header actions: + dropdown, Upload dropdown
  const [plusOpen, setPlusOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(e: globalThis.MouseEvent) {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false)
      if (uploadRef.current && !uploadRef.current.contains(e.target as Node)) setUploadOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  const headerActions = (
    <div className="ml-auto flex items-center gap-1.5">
      <div ref={plusRef} className="relative">
        <button
          type="button"
          onClick={() => { setPlusOpen((v) => !v); setUploadOpen(false) }}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          aria-label="Create"
        >
          <Plus size={14} />
          <ChevronDown size={11} className="opacity-60" />
        </button>
        {plusOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
            <button
              type="button"
              onClick={() => { setPlusOpen(false); void createChat() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <MessageSquare size={13} /> New chat
            </button>
            <button
              type="button"
              onClick={() => { setPlusOpen(false); void createNote() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <BookOpen size={13} /> New file
            </button>
          </div>
        )}
      </div>
      <div ref={uploadRef} className="relative">
        <button
          type="button"
          onClick={() => { setUploadOpen((v) => !v); setPlusOpen(false) }}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          aria-label="Upload"
          disabled={uploading}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <ChevronDown size={11} className="opacity-60" />
        </button>
        {uploadOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
            <button
              type="button"
              onClick={() => { setUploadOpen(false); fileInputRef.current?.click() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <FileText size={13} /> Upload file
            </button>
            <button
              type="button"
              onClick={() => { setUploadOpen(false); folderInputRef.current?.click() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <FolderPlus size={13} /> Upload folder
            </button>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = '' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error - non-standard attribute for folder uploads
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = '' }}
      />
    </div>
  )

  // Project name as the header title (replaces the chat title chip area).
  const projectHeaderTitle = (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:px-4 md:py-0">
      <FolderOpen size={16} className="shrink-0 text-[var(--muted)]" />
      {editingName ? (
        <input
          className="min-w-0 flex-1 max-w-md rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
          value={draftName}
          disabled={savingName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void commitProjectRename() }
            if (e.key === 'Escape') { setDraftName(projectName); setEditingName(false) }
          }}
          onBlur={() => void commitProjectRename()}
          autoFocus
        />
      ) : (
        <div className="group/project-head flex min-w-0 items-center gap-1">
          <h1
            className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {projectName || 'Project'}
          </h1>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/project-head:opacity-100 focus-visible:opacity-100"
            aria-label="Rename project"
            onClick={() => { setDraftName(projectName); setEditingName(true) }}
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
      {headerActions}
    </div>
  )

  // Tabs + list rendered below the empty composer
  const tabBtnClass = (active: boolean) =>
    `inline-flex items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
      active
        ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
    }`

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [chats],
  )
  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [files],
  )

  const tabs = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setActiveTab('chats')} className={tabBtnClass(activeTab === 'chats')}>
          Chats
        </button>
        <button type="button" onClick={() => setActiveTab('files')} className={tabBtnClass(activeTab === 'files')}>
          Files
        </button>
        <button type="button" onClick={() => setActiveTab('instructions')} className={tabBtnClass(activeTab === 'instructions')}>
          Instructions
        </button>
      </div>

      {activeTab === 'chats' && (
        <div>
          {listsLoading ? (
            <div className="flex justify-center py-6 text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /></div>
          ) : sortedChats.length === 0 ? (
            <p className="px-1 py-2 text-xs text-[var(--muted)]">No chats yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {sortedChats.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => openChat(c._id)}
                    className="flex w-full items-center gap-2 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
                  >
                    <MessageSquare size={13} className="shrink-0 text-[var(--muted-light)]" />
                    <span className="min-w-0 flex-1 truncate">{c.title || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          {listsLoading ? (
            <div className="flex justify-center py-6 text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /></div>
          ) : sortedFiles.length === 0 ? (
            <p className="px-1 py-2 text-xs text-[var(--muted)]">No files yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {sortedFiles.map((f) => (
                <li key={f._id}>
                  <button
                    type="button"
                    onClick={() => openFile(f)}
                    className="flex w-full items-center gap-2 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
                  >
                    {opensInDocumentEditor(f) ? (
                      <BookOpen size={13} className="shrink-0 text-[var(--muted-light)]" />
                    ) : (
                      <FileText size={13} className="shrink-0 text-[var(--muted-light)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{f.name || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'instructions' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--muted)]">
            Set context and customize how Overlay responds in this project.
          </p>
          <textarea
            value={instructions}
            disabled={!instructionsLoaded}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder={instructionsLoaded ? 'Project instructions…' : 'Loading…'}
            rows={8}
            className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
          />
          <div className="flex h-4 items-center text-[11px] text-[var(--muted-light)]">
            {savingInstructions ? 'Saving…' : instructionsSavedAt ? 'Saved' : ''}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {projectHeaderTitle}
      <div className="min-h-0 flex-1">
        <ChatInterface
          userId={userId}
          firstName={firstName}
          hideSidebar
          hideHeader
          projectName={projectName}
          belowEmptyComposer={tabs}
        />
      </div>
    </div>
  )
}

// ─── Empty Projects landing (no projectId) ───────────────────────────────────

function ProjectsEmpty() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function createProject() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/app/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled project' }),
      })
      if (!res.ok) return
      const data = (await res.json().catch(() => ({}))) as {
        id?: string
        project?: { _id?: string; name?: string }
      }
      const id = data.project?._id || data.id
      const name = data.project?.name || 'Untitled project'
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT))
      if (id) {
        router.push(
          `/app/projects?projectId=${encodeURIComponent(id)}&projectName=${encodeURIComponent(name)}`,
        )
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:px-4 md:py-0">
        <h1
          className="text-lg font-medium text-[var(--foreground)]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Projects
        </h1>
        <button
          type="button"
          onClick={() => void createProject()}
          disabled={creating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New project
        </button>
      </div>
      {/* Empty state body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-[var(--muted)]">No projects yet.</p>
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
      <ProjectHubBody
        projectId={projectId.trim()}
        projectName={projectName?.trim() || 'Project'}
        userId={userId}
        firstName={firstName}
      />
    )
  }

  return <ProjectsEmpty />
}
