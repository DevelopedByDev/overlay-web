'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  MessageSquare,
  Trash2,
  Workflow,
} from 'lucide-react'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/app/ConfirmDialog'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import {
  CHAT_CREATED_EVENT,
  CHAT_DELETED_EVENT,
  CHAT_MODIFIED_EVENT,
  CHAT_TITLE_UPDATED_EVENT,
  dispatchChatDeleted,
  dispatchChatTitleUpdated,
  sanitizeChatTitle,
  type ChatCreatedDetail,
  type ChatDeletedDetail,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'
import { fetchChatList, getCachedChatList, removeCachedChat, upsertCachedChat } from '@/lib/chat-list-cache'

const PROJECT_META_UPDATED_EVENT = 'overlay:project-meta-updated'
const AUTOMATIONS_UPDATED_EVENT = 'overlay:automations-updated'
const FILES_CHANGED_EVENT = 'overlay:files-changed'

type Conversation = { _id: string; title: string; lastModified: number }
type Note = { _id: string; title: string; updatedAt: number }
type CanonicalNoteFile = { _id: string; name?: string; updatedAt?: number }
type Project = { _id: string; name: string; parentId: string | null }
type ProjectChat = { _id: string; title: string; lastModified: number }
type ProjectNote = { _id: string; title: string; updatedAt: number }
type ProjectFile = {
  _id: string
  name: string
  type: 'file' | 'folder'
  kind?: 'folder' | 'note' | 'upload' | 'output'
  parentId: string | null
  mimeType?: string
  extension?: string
  outputType?: string
}

function opensInDocumentEditor(file: ProjectFile): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
}

const panelItemClass =
  'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

export function ChatInlinePanel({
  refreshKey,
  searchQuery = '',
  onNavigate,
}: {
  refreshKey: number
  searchQuery?: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessions, getUnread } = useAsyncSessions()
  const [chats, setChats] = useState<Conversation[]>(() => getCachedChatList() ?? [])
  const [loading, setLoading] = useState(() => !getCachedChatList())
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingChatIds, setDeletingChatIds] = useState<string[]>([])
  const [confirmDeleteChat, setConfirmDeleteChat] = useState<Conversation | null>(null)
  const activeId = searchParams?.get('id') ?? null

  const loadChats = useCallback(async (options: { force?: boolean } = {}) => {
    try {
      setChats(await fetchChatList(options))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getCachedChatList()) setLoading(true)
    void loadChats()
  }, [loadChats, refreshKey])

  useEffect(() => {
    function handleChatUpserted(event: Event) {
      const { detail } = event as CustomEvent<ChatCreatedDetail>
      const nextChat = detail?.chat
      if (!nextChat?._id) return
      upsertCachedChat(nextChat)
      setLoading(false)
      setChats((prev) => {
        const existingIndex = prev.findIndex((chat) => chat._id === nextChat._id)
        if (existingIndex === -1) return [nextChat, ...prev]
        const existing = prev[existingIndex]
        const merged = {
          ...existing,
          ...nextChat,
          title: nextChat.title || existing.title,
        }
        const withoutExisting = prev.filter((chat) => chat._id !== nextChat._id)
        return [merged, ...withoutExisting]
      })
    }

    function handleChatTitleUpdated(event: Event) {
      const { detail } = event as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId || !detail.title) return
      upsertCachedChat({
        _id: detail.chatId,
        title: detail.title,
        lastModified: Date.now(),
      })
      setChats((prev) => {
        const existing = prev.find((chat) => chat._id === detail.chatId)
        if (!existing) return prev
        const updated = { ...existing, title: detail.title, lastModified: Date.now() }
        return [updated, ...prev.filter((chat) => chat._id !== detail.chatId)]
      })
    }

    function handleChatDeleted(event: Event) {
      const { detail } = event as CustomEvent<ChatDeletedDetail>
      if (!detail?.chatId) return
      const deletedChatId = detail.chatId
      removeCachedChat(deletedChatId)
      setDeletingChatIds((prev) => (
        prev.includes(deletedChatId) ? prev : [...prev, deletedChatId]
      ))
      window.setTimeout(() => {
        setChats((prev) => prev.filter((chat) => chat._id !== deletedChatId))
        setDeletingChatIds((prev) => prev.filter((id) => id !== deletedChatId))
      }, 180)
    }
    window.addEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    window.addEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    return () => {
      window.removeEventListener(CHAT_CREATED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_MODIFIED_EVENT, handleChatUpserted)
      window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
      window.removeEventListener(CHAT_DELETED_EVENT, handleChatDeleted)
    }
  }, [])

  function beginRename(chat: Conversation, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setEditingChatId(chat._id)
    setEditingTitle(chat.title)
  }

  function cancelRename() {
    setEditingChatId(null)
    setEditingTitle('')
  }

  async function saveRename(chatId: string) {
    const previousTitle = chats.find((chat) => chat._id === chatId)?.title ?? 'New Chat'
    const nextTitle = sanitizeChatTitle(editingTitle, previousTitle)
    cancelRename()
    if (nextTitle === previousTitle) return

    setChats((prev) => prev.map((chat) => (
      chat._id === chatId ? { ...chat, title: nextTitle } : chat
    )))
    dispatchChatTitleUpdated({ chatId, title: nextTitle })

    try {
      const response = await fetch('/api/app/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: chatId, title: nextTitle }),
      })
      if (!response.ok) throw new Error('Failed to rename chat')
    } catch {
      setChats((prev) => prev.map((chat) => (
        chat._id === chatId ? { ...chat, title: previousTitle } : chat
      )))
      dispatchChatTitleUpdated({ chatId, title: previousTitle })
    }
  }

  function requestDeleteChat(chat: Conversation, event: MouseEvent) {
    event.stopPropagation()
    setConfirmDeleteChat(chat)
  }

  async function confirmDeleteChatAction() {
    const chat = confirmDeleteChat
    if (!chat) return
    const chatId = chat._id
    setConfirmDeleteChat(null)
    dispatchChatDeleted({ chatId })
    await fetch(`/api/app/conversations?conversationId=${chatId}`, { method: 'DELETE' })
    if (activeId === chatId) {
      router.push('/app/chat')
    }
  }

  const filteredChats = searchQuery.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={6} />
      ) : filteredChats.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">{chats.length === 0 ? 'No chats yet' : 'No results'}</p>
      ) : filteredChats.map((chat) => {
        const isStreaming = sessions[chat._id]?.status === 'streaming'
        const unread = getUnread(chat._id)
        const active = activeId === chat._id
        const isEditing = editingChatId === chat._id
        const isDeleting = deletingChatIds.includes(chat._id)
        return (
          <div
            key={chat._id}
            onClick={() => {
              if (isDeleting) return
              if (isEditing) return
              router.push(`/app/chat?id=${encodeURIComponent(chat._id)}`)
              onNavigate?.()
            }}
            className={`${panelItemClass} cursor-pointer overflow-hidden transition-all duration-200 ${
              isDeleting ? 'max-h-0 -translate-y-1 py-0 opacity-0' : 'max-h-10 opacity-100'
            } ${active ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
          >
            <MessageSquare size={12} className="shrink-0" />
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveRename(chat._id)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelRename()
                  }
                }}
                onBlur={() => void saveRename(chat._id)}
                className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            )}
            {isStreaming && !unread ? (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
            ) : null}
            {unread > 0 ? (
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[9px] font-medium text-[var(--background)]">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void saveRename(chat._id)
                }}
                className="ml-1 shrink-0 rounded p-0.5 text-[var(--foreground)] hover:bg-[var(--border)]"
                aria-label="Save chat name"
              >
                <Check size={11} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(event) => beginRename(chat, event)}
                  className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                  aria-label="Rename chat"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={(event) => requestDeleteChat(chat, event)}
                  className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                  aria-label="Delete chat"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        )
      })}
      <ConfirmDialog
        isOpen={confirmDeleteChat !== null}
        title="Delete chat?"
        description={confirmDeleteChat ? `“${confirmDeleteChat.title || 'Untitled chat'}” will be permanently deleted. This can’t be undone.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => void confirmDeleteChatAction()}
        onCancel={() => setConfirmDeleteChat(null)}
      />
    </div>
  )
}

export function NotesInlinePanel({
  refreshKey,
  searchQuery = '',
  onNavigate,
}: {
  refreshKey: number
  searchQuery?: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const activeId = searchParams?.get('id') ?? null

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/app/files?kind=note')
      if (res.ok) {
        const rows = (await res.json()) as CanonicalNoteFile[]
        setNotes(rows.map((file) => ({
          _id: file._id,
          title: file.name || 'Untitled',
          updatedAt: file.updatedAt ?? 0,
        })))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadNotes()
  }, [loadNotes, refreshKey])

  useEffect(() => {
    function handleNotesChanged(event: Event) {
      const note = (event as CustomEvent<{ note?: Note }>).detail?.note
      if (note?._id) {
        setNotes((prev) => [note, ...prev.filter((item) => item._id !== note._id)])
        setLoading(false)
        return
      }
      void loadNotes()
    }

    window.addEventListener('overlay:notes-changed', handleNotesChanged)
    return () => window.removeEventListener('overlay:notes-changed', handleNotesChanged)
  }, [loadNotes])

  async function deleteNote(noteId: string, event: MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/files?fileId=${noteId}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((note) => note._id !== noteId))
    if (activeId === noteId) {
      router.push('/app/notes')
    }
  }

  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={6} />
      ) : filteredNotes.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">{notes.length === 0 ? 'No notes yet' : 'No results'}</p>
      ) : filteredNotes.map((note) => {
        const active = activeId === note._id
        return (
          <div
            key={note._id}
            onClick={() => {
              router.push(`/app/notes?id=${encodeURIComponent(note._id)}`)
              onNavigate?.()
            }}
            className={`${panelItemClass} cursor-pointer ${active ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
          >
            <BookOpen size={12} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
            <button
              type="button"
              onClick={(event) => void deleteNote(note._id, event)}
              className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FilesBranch({
  file,
  allFiles,
  depth,
  expanded,
  activeFileId,
  onToggle,
  onOpen,
  onMove,
}: {
  file: ProjectFile
  allFiles: ProjectFile[]
  depth: number
  expanded: Set<string>
  activeFileId: string | null
  onToggle: (fileId: string) => void
  onOpen: (file: ProjectFile) => void
  onMove: (fileId: string, parentId: string | null) => void
}) {
  const children = allFiles
    .filter((candidate) => candidate.parentId === file._id)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  const open = expanded.has(file._id)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-overlay-file-id', file._id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          if (file.type !== 'folder') return
          if (!e.dataTransfer.types.includes('application/x-overlay-file-id')) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (file.type !== 'folder') return
          e.preventDefault()
          setDragOver(false)
          const fileId = e.dataTransfer.getData('application/x-overlay-file-id')
          if (!fileId || fileId === file._id) return
          onMove(fileId, file._id)
        }}
        onClick={() => onOpen(file)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(file)
          }
        }}
        className={`${panelItemClass} cursor-pointer ${dragOver ? 'bg-[var(--surface-subtle)] ring-1 ring-inset ring-[var(--foreground)]' : activeFileId === file._id ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {file.type === 'folder' ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(file._id)
            }}
            className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            aria-label={open ? 'Collapse folder' : 'Expand folder'}
          >
            <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : null}
        {file.type === 'folder'
          ? open
            ? <FolderOpen size={12} className="shrink-0" />
            : <Folder size={12} className="shrink-0" />
          : file.kind === 'note'
            ? <BookOpen size={12} className="shrink-0 text-[var(--muted-light)]" />
            : <FileText size={12} className="shrink-0 text-[var(--muted-light)]" />}
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
      </div>

      {file.type === 'folder' && open && children.map((child) => (
        <FilesBranch
          key={child._id}
          file={child}
          allFiles={allFiles}
          depth={depth + 1}
          expanded={expanded}
          activeFileId={activeFileId}
          onToggle={onToggle}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

export function FilesInlinePanel({
  searchQuery = '',
  onNavigate,
}: {
  searchQuery?: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const activeFileId = searchParams?.get('file') ?? null
  const activeNoteId = searchParams?.get('id') ?? null
  const activeCanonicalFileId = activeFileId ?? activeNoteId

  const loadItems = useCallback(async () => {
    try {
      const filesRes = await fetch('/api/app/files')
      setFiles(filesRes.ok ? await filesRes.json() : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    function handleFilesChanged() {
      void loadItems()
    }
    window.addEventListener('overlay:notes-changed', handleFilesChanged)
    window.addEventListener(FILES_CHANGED_EVENT, handleFilesChanged)
    return () => {
      window.removeEventListener('overlay:notes-changed', handleFilesChanged)
      window.removeEventListener(FILES_CHANGED_EVENT, handleFilesChanged)
    }
  }, [loadItems])

  function toggleFile(fileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  function openFile(file: ProjectFile) {
    if (file.type === 'folder') {
      router.push(`/app/files?folder=${encodeURIComponent(file._id)}`)
      onNavigate?.()
      return
    }
    if (opensInDocumentEditor(file)) {
      router.push(`/app/notes?id=${encodeURIComponent(file._id)}`)
    } else {
      router.push(`/app/files?file=${encodeURIComponent(file._id)}`)
    }
    onNavigate?.()
  }

  async function moveFile(fileId: string, parentId: string | null) {
    if (fileId === parentId) return
    if (parentId) {
      let cur: string | null = parentId
      while (cur) {
        if (cur === fileId) return
        const next: ProjectFile | undefined = files.find((candidate) => candidate._id === cur)
        cur = next?.parentId ?? null
      }
    }
    const res = await fetch('/api/app/files', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, parentId }),
    })
    if (res.ok) {
      await loadItems()
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
    }
  }

  const q = searchQuery.trim().toLowerCase()
  const filteredFiles = useMemo(() => {
    if (!q) return files
    const keep = new Set<string>()
    for (const file of files) {
      if (file.name.toLowerCase().includes(q)) {
        keep.add(file._id)
        let parentId = file.parentId
        while (parentId) {
          keep.add(parentId)
          parentId = files.find((candidate) => candidate._id === parentId)?.parentId ?? null
        }
      }
    }
    return files.filter((file) => keep.has(file._id))
  }, [files, q])

  const rootFiles = filteredFiles
    .filter((file) => file.parentId == null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  const hasItems = rootFiles.length > 0

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={7} />
      ) : !hasItems ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">{q ? 'No results' : 'No files yet'}</p>
      ) : (
        <>
          {rootFiles.map((file) => (
            <FilesBranch
              key={file._id}
              file={file}
              allFiles={filteredFiles}
              depth={0}
              expanded={expanded}
              activeFileId={activeCanonicalFileId}
              onToggle={toggleFile}
              onOpen={openFile}
              onMove={moveFile}
            />
          ))}
        </>
      )}
    </div>
  )
}

function ProjectBranch({
  project,
  allProjects,
  depth,
  expanded,
  activeProjectId,
  items,
  itemsLoading,
  onToggle,
  onOpenProject,
  onNavigateItem,
  onDeleteProject,
  onDeleteItem,
  onProjectRenamed,
}: {
  project: Project
  allProjects: Project[]
  depth: number
  expanded: Set<string>
  activeProjectId: string | null
  items: Record<string, { chats: ProjectChat[]; notes: ProjectNote[]; files: ProjectFile[] }>
  itemsLoading: Set<string>
  onToggle: (projectId: string) => void
  onOpenProject: (project: Project) => void
  onNavigateItem: (project: Project, view: 'chat' | 'note' | 'file', id: string) => void
  onDeleteProject: (projectId: string, event: MouseEvent) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, event: MouseEvent) => void
  onProjectRenamed: (projectId: string, name: string) => void
}) {
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const children = allProjects.filter((candidate) => candidate.parentId === project._id)
  const open = expanded.has(project._id)
  const projectItems = items[project._id]
  const rootFiles = useMemo(() => (projectItems?.files ?? [])
    .filter((file) => file.parentId == null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    }), [projectItems])

  async function commitProjectRowRename() {
    if (renamingProjectId !== project._id) return
    const name = renameDraft.trim()
    setRenamingProjectId(null)
    if (!name || name === project.name) return
    try {
      const res = await fetch('/api/app/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project._id, name }),
      })
      if (!res.ok) return
      const data = (await res.json().catch(() => ({}))) as { project?: Project }
      const finalName = data.project?.name?.trim() || name
      onProjectRenamed(project._id, finalName)
      window.dispatchEvent(
        new CustomEvent(PROJECT_META_UPDATED_EVENT, { detail: { projectId: project._id, name: finalName } }),
      )
    } catch {
      /* keep previous name in UI */
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (renamingProjectId === project._id) return
          onOpenProject(project)
        }}
        onKeyDown={(e) => {
          if (renamingProjectId === project._id) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenProject(project)
          }
        }}
        className={`${panelItemClass} cursor-pointer ${activeProjectId === project._id ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggle(project._id)
          }}
          className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
          aria-label={open ? 'Collapse project' : 'Expand project'}
        >
          <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {open ? <FolderOpen size={12} className="shrink-0" /> : <Folder size={12} className="shrink-0" />}
        {renamingProjectId === project._id ? (
          <input
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-xs text-[var(--foreground)] outline-none"
            value={renameDraft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commitProjectRowRename()
              }
              if (e.key === 'Escape') {
                setRenamingProjectId(null)
                setRenameDraft('')
              }
            }}
            onBlur={() => void commitProjectRowRename()}
            autoFocus
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setRenamingProjectId(project._id)
            setRenameDraft(project.name)
          }}
          className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
          aria-label="Rename project"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={(event) => onDeleteProject(project._id, event)}
          className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {open && (
        <div className="space-y-0.5">
          {children.map((child) => (
            <ProjectBranch
              key={child._id}
              project={child}
              allProjects={allProjects}
              depth={depth + 1}
              expanded={expanded}
              activeProjectId={activeProjectId}
              items={items}
              itemsLoading={itemsLoading}
              onToggle={onToggle}
              onOpenProject={onOpenProject}
              onNavigateItem={onNavigateItem}
              onDeleteProject={onDeleteProject}
              onDeleteItem={onDeleteItem}
              onProjectRenamed={onProjectRenamed}
            />
          ))}

          {itemsLoading.has(project._id) ? (
            <div className="space-y-1.5 py-1" style={{ paddingLeft: `${34 + depth * 14}px` }} aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 pr-2">
                  <div className="ui-skeleton-line h-2.5 w-2.5 shrink-0 rounded" />
                  <div
                    className="ui-skeleton-line h-2.5 max-w-[200px] flex-1 rounded"
                    style={{ width: `${78 - i * 6}%` }}
                  />
                </div>
              ))}
            </div>
          ) : projectItems ? (
            <>
              {projectItems.chats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => onNavigateItem(project, 'chat', chat._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <MessageSquare size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteItem('chat', chat._id, event)}
                    className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {projectItems.notes.map((note) => (
                <div
                  key={note._id}
                  onClick={() => onNavigateItem(project, 'note', note._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <BookOpen size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteItem('note', note._id, event)}
                    className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {rootFiles.map((file) => (
                <div
                  key={file._id}
                  onClick={() => onNavigateItem(project, opensInDocumentEditor(file) ? 'note' : 'file', file._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <FileText size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function ProjectsInlinePanel({
  refreshKey,
  onNavigate,
}: {
  refreshKey: number
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [itemsByProject, setItemsByProject] = useState<Record<string, { chats: ProjectChat[]; notes: ProjectNote[]; files: ProjectFile[] }>>({})
  const [itemsLoading, setItemsLoading] = useState<Set<string>>(new Set())
  const activeProjectId = searchParams?.get('projectId') ?? null

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/app/projects')
      if (res.ok) setProjects(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadProjects()
  }, [loadProjects, refreshKey])

  const loadProjectItems = useCallback(async (projectId: string) => {
    setItemsLoading((prev) => new Set(prev).add(projectId))
    try {
      const [chatsRes, notesRes, filesRes] = await Promise.all([
        fetch(`/api/app/conversations?projectId=${projectId}`),
        fetch(`/api/app/files?kind=note&projectId=${projectId}`),
        fetch(`/api/app/files?projectId=${projectId}`),
      ])
      const [chats, notes, files] = await Promise.all([
        chatsRes.ok ? chatsRes.json() : [],
        notesRes.ok ? notesRes.json() : [],
        filesRes.ok ? filesRes.json() : [],
      ])
      const noteRows = Array.isArray(notes)
        ? notes.map((note: ProjectFile) => ({ _id: note._id, title: note.name || 'Untitled', updatedAt: 0 }))
        : []
      const fileRows = Array.isArray(files)
        ? files.filter((file: ProjectFile) => file.kind !== 'note')
        : []
      setItemsByProject((prev) => ({ ...prev, [projectId]: { chats, notes: noteRows, files: fileRows } }))
    } finally {
      setItemsLoading((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }, [])

  function toggleProject(projectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
    if (!itemsByProject[projectId] && !itemsLoading.has(projectId)) {
      void loadProjectItems(projectId)
    }
  }

  function navigateItem(project: Project, view: 'chat' | 'note' | 'file', id: string) {
    router.push(`/app/projects?view=${view}&id=${id}&projectId=${project._id}&projectName=${encodeURIComponent(project.name)}`)
    onNavigate?.()
  }

  function openProjectHub(project: Project) {
    router.push(
      `/app/projects?projectId=${encodeURIComponent(project._id)}&projectName=${encodeURIComponent(project.name)}`,
    )
    onNavigate?.()
  }

  async function deleteProject(projectId: string, event: MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/projects?projectId=${projectId}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((project) => project._id !== projectId))
    setItemsByProject((prev) => {
      const next = { ...prev }
      delete next[projectId]
      return next
    })
  }

  function handleProjectRenamed(projectId: string, name: string) {
    setProjects((prev) => prev.map((p) => (p._id === projectId ? { ...p, name } : p)))
  }

  async function deleteItem(type: 'chat' | 'note', id: string, event: MouseEvent) {
    event.stopPropagation()
    if (type === 'chat') {
      await fetch(`/api/app/conversations?conversationId=${id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/app/files?fileId=${id}`, { method: 'DELETE' })
    }
    setItemsByProject((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        const entry = next[key]
        next[key] = {
          chats: type === 'chat' ? entry.chats.filter((chat) => chat._id !== id) : entry.chats,
          notes: type === 'note' ? entry.notes.filter((note) => note._id !== id) : entry.notes,
          files: entry.files,
        }
      }
      return next
    })
  }

  const rootProjects = useMemo(() => projects
    .filter((project) => project.parentId == null)
    .sort((a, b) => a.name.localeCompare(b.name)), [projects])

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={5} />
      ) : rootProjects.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No projects yet</p>
      ) : rootProjects.map((project) => (
        <ProjectBranch
          key={project._id}
          project={project}
          allProjects={projects}
          depth={0}
          expanded={expanded}
          activeProjectId={activeProjectId}
          items={itemsByProject}
          itemsLoading={itemsLoading}
          onToggle={toggleProject}
          onOpenProject={openProjectHub}
          onNavigateItem={navigateItem}
          onDeleteProject={deleteProject}
          onDeleteItem={deleteItem}
          onProjectRenamed={handleProjectRenamed}
        />
      ))}
    </div>
  )
}

export const knowledgeInlineItems = [
  { id: 'memories', label: 'Memories' },
  { id: 'files', label: 'Files' },
  { id: 'outputs', label: 'Outputs' },
] as const

export const toolsInlineItems = [
  { id: 'connectors', label: 'Connectors' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcps', label: 'MCPs' },
  { id: 'apps', label: 'Apps', locked: true },
] as const

type Automation = {
  _id: string
  name?: string
  title?: string
  enabled: boolean
  createdAt: number
  sourceConversationId?: string
  conversationId?: string
  nextRunAt?: number
  lastError?: string
}

export function AutomationsInlinePanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null)
  const [editingAutomationName, setEditingAutomationName] = useState('')
  const [confirmDeleteAutomation, setConfirmDeleteAutomation] = useState<Automation | null>(null)
  const [deletingAutomationIds, setDeletingAutomationIds] = useState<string[]>([])
  const [pendingNavId, setPendingNavId] = useState<string | null>(null)
  const activeId = searchParams?.get('id') ?? null
  const activeAutomationId = searchParams?.get('automationId') ?? null

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/app/automations')
      if (res.ok) setAutomations(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAutomations()
  }, [loadAutomations])

  useEffect(() => {
    function handleAutomationsUpdated() {
      setLoading(true)
      void loadAutomations()
    }
    window.addEventListener(AUTOMATIONS_UPDATED_EVENT, handleAutomationsUpdated)
    return () => window.removeEventListener(AUTOMATIONS_UPDATED_EVENT, handleAutomationsUpdated)
  }, [loadAutomations])

  function automationHref(automation: Automation): string {
    const conversationId = automation.sourceConversationId || automation.conversationId
    return conversationId
      ? `/app/automations?id=${encodeURIComponent(conversationId)}&automationId=${encodeURIComponent(automation._id)}`
      : `/app/automations?automationId=${encodeURIComponent(automation._id)}`
  }

  function beginAutomationRename(automation: Automation, event: MouseEvent) {
    event.stopPropagation()
    const label = automation.name || automation.title || 'Untitled automation'
    setEditingAutomationId(automation._id)
    setEditingAutomationName(label)
  }

  function cancelAutomationRename() {
    setEditingAutomationId(null)
    setEditingAutomationName('')
  }

  async function commitAutomationRename(automation: Automation) {
    const nextName = editingAutomationName.trim()
    const previousName = automation.name || automation.title || 'Untitled automation'
    if (!nextName || nextName === previousName) {
      cancelAutomationRename()
      return
    }

    setAutomations((prev) => prev.map((item) => (
      item._id === automation._id ? { ...item, name: nextName } : item
    )))
    cancelAutomationRename()
    try {
      const res = await fetch('/api/app/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: automation._id, name: nextName }),
      })
      if (!res.ok) throw new Error('Failed to rename automation')
      window.dispatchEvent(new Event(AUTOMATIONS_UPDATED_EVENT))
    } catch {
      setAutomations((prev) => prev.map((item) => (
        item._id === automation._id ? { ...item, name: previousName } : item
      )))
    }
  }

  async function performDeleteAutomation() {
    const automation = confirmDeleteAutomation
    if (!automation) return
    setDeletingAutomationIds((prev) => prev.includes(automation._id) ? prev : [...prev, automation._id])
    try {
      const res = await fetch(`/api/app/automations?automationId=${encodeURIComponent(automation._id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete automation')
      const payload = (await res.json().catch(() => ({}))) as { linkedConversationIds?: string[] }
      setAutomations((prev) => prev.filter((item) => item._id !== automation._id))
      for (const chatId of payload.linkedConversationIds ?? []) {
        dispatchChatDeleted({ chatId })
      }
      window.dispatchEvent(new Event(AUTOMATIONS_UPDATED_EVENT))
    } catch {
      // keep row in place
    } finally {
      setDeletingAutomationIds((prev) => prev.filter((id) => id !== automation._id))
      setConfirmDeleteAutomation(null)
    }
  }

  if (loading) return <SidebarListSkeleton rows={3} />

  if (automations.length === 0) {
    return <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No automations yet</p>
  }

  return (
    <>
    <div className="space-y-0.5">
      {automations.map((automation) => {
        const statusLabel = automation.lastError
          ? 'Error'
          : automation.enabled
            ? 'Enabled'
            : 'Paused'
        const iconColor = automation.lastError
          ? 'text-red-500'
          : automation.enabled
            ? 'text-green-500'
            : 'text-[var(--muted-light)]'
        const conversationId = automation.sourceConversationId || automation.conversationId
        const automationLabel = automation.name || automation.title || 'Untitled automation'
        const isActive = activeAutomationId === automation._id || activeId === automation._id || activeId === conversationId
        const isEditing = editingAutomationId === automation._id
        const isDeleting = deletingAutomationIds.includes(automation._id)
        return (
          <div
            key={automation._id}
            title={automation.lastError || statusLabel}
            className={`group/automation-row flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
            }`}
          >
            <button
              type="button"
              disabled={isDeleting || pendingNavId === automation._id}
              onClick={async () => {
                if (isEditing) return
                // Prefetch automation detail before navigating so the destination
                // page renders fully populated instead of a loading shell.
                setPendingNavId(automation._id)
                try {
                  await fetch(
                    `/api/app/automations?automationId=${encodeURIComponent(automation._id)}`,
                    { credentials: 'same-origin', cache: 'no-store' },
                  ).catch(() => null)
                } finally {
                  setPendingNavId(null)
                  router.push(automationHref(automation))
                  onNavigate?.()
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-0.5 text-left disabled:cursor-default disabled:opacity-50"
            >
              {pendingNavId === automation._id ? (
                <Loader2 size={13} strokeWidth={1.75} className="shrink-0 animate-spin text-[var(--muted)]" />
              ) : (
                <Workflow size={13} strokeWidth={1.75} className={`shrink-0 ${iconColor}`} />
              )}
              {isEditing ? (
                <input
                  autoFocus
                  value={editingAutomationName}
                  onChange={(event) => setEditingAutomationName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void commitAutomationRename(automation)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelAutomationRename()
                    }
                  }}
                  onBlur={() => void commitAutomationRename(automation)}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] outline-none"
                />
              ) : (
                <span className="flex-1 truncate text-left">{automationLabel}</span>
              )}
            </button>
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={(event) => beginAutomationRename(automation, event)}
                  disabled={isDeleting}
                  className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                  aria-label="Rename automation"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setConfirmDeleteAutomation(automation)
                  }}
                  disabled={isDeleting}
                  className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-red-500 disabled:opacity-30 group-hover/automation-row:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete automation"
                >
                  <Trash2 size={11} />
                </button>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
    <ConfirmDialog
      isOpen={confirmDeleteAutomation !== null}
      title="Delete automation?"
      description={confirmDeleteAutomation ? `"${confirmDeleteAutomation.name || confirmDeleteAutomation.title || 'Untitled automation'}" will be deleted. This can't be undone.` : undefined}
      confirmLabel="Delete"
      onConfirm={() => void performDeleteAutomation()}
      onCancel={() => setConfirmDeleteAutomation(null)}
    />
    </>
  )
}

export function InlineNavChildren({
  items,
  activeId,
  onSelect,
}: {
  items: ReadonlyArray<{ id: string; label: string; locked?: boolean }>
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="mt-1 space-y-0.5 pl-7">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            if (!item.locked) onSelect(item.id)
          }}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
            item.locked
              ? 'cursor-default text-[var(--muted-light)]'
              : activeId === item.id
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
          }`}
        >
          <span className="flex-1 text-left">{item.label}</span>
          {item.locked ? <span className="text-[10px] text-[var(--muted-light)]">Soon</span> : null}
        </button>
      ))}
    </div>
  )
}
