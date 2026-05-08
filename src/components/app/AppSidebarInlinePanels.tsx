'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  MessageSquare,
  Pencil,
  Trash2,
} from 'lucide-react'
import { SidebarListSkeleton } from '@/components/ui/Skeleton'

const PROJECT_META_UPDATED_EVENT = 'overlay:project-meta-updated'
const FILES_CHANGED_EVENT = 'overlay:files-changed'

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

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
  mimeType?: string
  extension?: string
  parentId: string | null
}

function opensInDocumentEditor(file: ProjectFile): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
}

const panelItemClass =
  'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

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
        setNotes(sortNotes(rows.map((file) => ({
          _id: file._id,
          title: file.name || 'Untitled',
          updatedAt: file.updatedAt ?? 0,
        }))))
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
        setNotes((prev) => sortNotes([note, ...prev.filter((item) => item._id !== note._id)]))
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
