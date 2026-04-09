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
  Pencil,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'
import { useAsyncSessions } from '@/lib/async-sessions-store'
import {
  CHAT_TITLE_UPDATED_EVENT,
  dispatchChatTitleUpdated,
  sanitizeChatTitle,
  type ChatTitleUpdatedDetail,
} from '@/lib/chat-title'

type Conversation = { _id: string; title: string; lastModified: number }
type Note = { _id: string; title: string; updatedAt: number }
type Project = { _id: string; name: string; parentId: string | null }
type ProjectChat = { _id: string; title: string; lastModified: number }
type ProjectNote = { _id: string; title: string; updatedAt: number }
type ProjectFile = { _id: string; name: string; type: 'file' | 'folder'; parentId: string | null }

const panelItemClass =
  'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

export function ChatInlinePanel({
  refreshKey,
  onNavigate,
}: {
  refreshKey: number
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessions, getUnread } = useAsyncSessions()
  const [chats, setChats] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const activeId = searchParams?.get('id') ?? null

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch('/api/app/conversations')
      if (res.ok) setChats(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadChats()
  }, [loadChats, refreshKey])

  useEffect(() => {
    function handleChatTitleUpdated(event: Event) {
      const { detail } = event as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId || !detail.title) return
      setChats((prev) => prev.map((chat) => (
        chat._id === detail.chatId ? { ...chat, title: detail.title } : chat
      )))
    }
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    return () => window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
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

  async function deleteChat(chatId: string, event: MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/conversations?conversationId=${chatId}`, { method: 'DELETE' })
    setChats((prev) => prev.filter((chat) => chat._id !== chatId))
    if (activeId === chatId) {
      router.push('/app/chat')
    }
  }

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={6} />
      ) : chats.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No chats yet</p>
      ) : chats.map((chat) => {
        const isStreaming = sessions[chat._id]?.status === 'streaming'
        const unread = getUnread(chat._id)
        const active = activeId === chat._id
        const isEditing = editingChatId === chat._id
        return (
          <div
            key={chat._id}
            onClick={() => {
              if (isEditing) return
              router.push(`/app/chat?id=${encodeURIComponent(chat._id)}`)
              onNavigate?.()
            }}
            className={`${panelItemClass} cursor-pointer ${active ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
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
                  onClick={(event) => void deleteChat(chat._id, event)}
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
    </div>
  )
}

export function NotesInlinePanel({
  refreshKey,
  onNavigate,
}: {
  refreshKey: number
  onNavigate?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const activeId = searchParams?.get('id') ?? null

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/app/notes')
      if (res.ok) setNotes(await res.json())
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

  async function deleteNote(noteId: string, event: MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/notes?noteId=${noteId}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((note) => note._id !== noteId))
    if (activeId === noteId) {
      router.push('/app/notes')
    }
  }

  return (
    <div className="space-y-0.5">
      {loading ? (
        <SidebarListSkeleton rows={6} />
      ) : notes.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No notes yet</p>
      ) : notes.map((note) => {
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

function ProjectBranch({
  project,
  allProjects,
  depth,
  expanded,
  activeProjectId,
  items,
  itemsLoading,
  onToggle,
  onNavigateItem,
  onDeleteProject,
  onDeleteItem,
}: {
  project: Project
  allProjects: Project[]
  depth: number
  expanded: Set<string>
  activeProjectId: string | null
  items: Record<string, { chats: ProjectChat[]; notes: ProjectNote[]; files: ProjectFile[] }>
  itemsLoading: Set<string>
  onToggle: (projectId: string) => void
  onNavigateItem: (project: Project, view: 'chat' | 'note' | 'file', id: string) => void
  onDeleteProject: (projectId: string, event: MouseEvent) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, event: MouseEvent) => void
}) {
  const children = allProjects.filter((candidate) => candidate.parentId === project._id)
  const open = expanded.has(project._id)
  const projectItems = items[project._id]
  const rootFiles = useMemo(() => (projectItems?.files ?? [])
    .filter((file) => file.parentId == null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    }), [projectItems])

  return (
    <div>
      <div
        onClick={() => onToggle(project._id)}
        className={`${panelItemClass} cursor-pointer ${activeProjectId === project._id ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        <ChevronRight size={11} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? <FolderOpen size={12} className="shrink-0" /> : <Folder size={12} className="shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
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
              onNavigateItem={onNavigateItem}
              onDeleteProject={onDeleteProject}
              onDeleteItem={onDeleteItem}
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
                  onClick={() => onNavigateItem(project, 'file', file._id)}
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
        fetch(`/api/app/notes?projectId=${projectId}`),
        fetch(`/api/app/files?projectId=${projectId}`),
      ])
      const [chats, notes, files] = await Promise.all([
        chatsRes.ok ? chatsRes.json() : [],
        notesRes.ok ? notesRes.json() : [],
        filesRes.ok ? filesRes.json() : [],
      ])
      setItemsByProject((prev) => ({ ...prev, [projectId]: { chats, notes, files } }))
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

  async function deleteItem(type: 'chat' | 'note', id: string, event: MouseEvent) {
    event.stopPropagation()
    if (type === 'chat') {
      await fetch(`/api/app/conversations?conversationId=${id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/app/notes?noteId=${id}`, { method: 'DELETE' })
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
          onNavigateItem={navigateItem}
          onDeleteProject={deleteProject}
          onDeleteItem={deleteItem}
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
  { id: 'all', label: 'All' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcps', label: 'MCPs' },
  { id: 'apps', label: 'Apps', locked: true },
] as const

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
