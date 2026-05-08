'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, FolderOpen, Folder, ChevronRight, MessageSquare,
  BookOpen, Upload, FolderPlus, Loader2, Trash2, ArrowLeft, Pencil,
} from 'lucide-react'
import { CHAT_TITLE_UPDATED_EVENT, dispatchChatDeleted, type ChatTitleUpdatedDetail } from '@/lib/chat-title'
import { ConfirmDialog } from '@/components/app/ConfirmDialog'
import {
  ProjectFileTreeNode,
  type Project,
  type ProjectChat,
  type ProjectNote,
  type ProjectFile,
  opensInDocumentEditor,
  TREE_GUTTER_PX,
  TREE_CHEVRON_COL,
  TREE_ICON_COL,
} from './ProjectFileTree'
import { readNewChatModelFieldsFromStorage } from '@/lib/chat-model-prefs'
import { getFileType } from './FileViewer'

const PROJECT_META_UPDATED_EVENT = 'overlay:project-meta-updated'

// ─── Project tree node ────────────────────────────────────────────────────────

function ProjectNode({
  project,
  allProjects,
  depth,
  selectedId,
  expandedIds,
  onNavigate,
  onToggle,
  onDelete,
  onNavigateItem,
  onDeleteItem,
  onProjectRenamed,
}: {
  project: Project
  allProjects: Project[]
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onNavigate: (project: Project) => void
  onToggle: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onNavigateItem: (project: Project, view: string, id: string) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, e: React.MouseEvent) => void
  onProjectRenamed: (projectId: string, name: string) => void
}) {
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const children = allProjects.filter((p) => p.parentId === project._id)
  const isOpen = expandedIds.has(project._id)
  const isSelected = project._id === selectedId
  const itemPlPx = depth * 16 + 28
  const itemPl = `${itemPlPx}px`

  // Inline items loaded on-demand when expanded
  const [items, setItems] = useState<{ chats: ProjectChat[]; notes: ProjectNote[]; files: ProjectFile[] } | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen || items !== null) return
    let cancelled = false
    async function load() {
      setItemsLoading(true)
      try {
        const [cr, nr, fr] = await Promise.all([
          fetch(`/api/app/conversations?projectId=${project._id}`),
          fetch(`/api/app/files?kind=note&projectId=${project._id}`),
          fetch(`/api/app/files?projectId=${project._id}`),
        ])
        if (cancelled) return
        const [chats, notes, files] = await Promise.all([
          cr.ok ? cr.json() : [],
          nr.ok ? nr.json() : [],
          fr.ok ? fr.json() : [],
        ])
        const noteRows = Array.isArray(notes)
          ? notes.map((note: ProjectFile) => ({ _id: note._id, title: note.name || 'Untitled', updatedAt: 0 }))
          : []
        const fileRows = Array.isArray(files)
          ? files.filter((file: ProjectFile) => file.kind !== 'note')
          : []
        if (!cancelled) setItems({ chats, notes: noteRows, files: fileRows })
      } finally {
        if (!cancelled) setItemsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, project._id, items])

  function toggleInlineFileFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedFileIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteInlineFile(fileId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/files?fileId=${fileId}`, { method: 'DELETE' })
    setItems((prev) => (prev ? { ...prev, files: prev.files.filter((f) => f._id !== fileId) } : null))
  }

  const rootInlineFiles = items?.files
    .filter((f) => f.parentId == null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    }) ?? []

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
      /* keep UI name */
    }
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
          isSelected ? 'bg-[#e8e8e8] text-[#0a0a0a]' : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
        onClick={() => {
          if (renamingProjectId === project._id) return
          onNavigate(project)
        }}
      >
        <button
          type="button"
          onClick={(e) => onToggle(project._id, e)}
          className="shrink-0 p-0.5 rounded hover:bg-[#d8d8d8] transition-colors"
        >
          <ChevronRight size={10} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen
          ? <FolderOpen size={12} className="shrink-0 text-[#888]" />
          : <Folder size={12} className="shrink-0 text-[#888]" />}
        {renamingProjectId === project._id ? (
          <input
            className="min-w-0 flex-1 rounded border border-[#ccc] bg-white px-1 py-0.5 text-xs text-[#0a0a0a] outline-none"
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
          <span className="flex-1 truncate">{project.name}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setRenamingProjectId(project._id)
            setRenameDraft(project.name)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
          aria-label="Rename project"
        >
          <Pencil size={10} />
        </button>
        <button
          type="button"
          onClick={(e) => onDelete(project._id, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {isOpen && (
        <>
          {children.map((child) => (
            <ProjectNode
              key={child._id}
              project={child}
              allProjects={allProjects}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onNavigate={onNavigate}
              onToggle={onToggle}
              onDelete={onDelete}
              onNavigateItem={onNavigateItem}
              onDeleteItem={onDeleteItem}
              onProjectRenamed={onProjectRenamed}
            />
          ))}

          {itemsLoading ? (
            <div className="flex items-center py-1.5" style={{ paddingLeft: itemPl }}>
              <Loader2 size={10} className="animate-spin text-[#bbb]" />
            </div>
          ) : items && (
            <>
              {items.chats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => onNavigateItem(project, 'chat', chat._id)}
                  className="group flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors"
                  style={{ paddingLeft: itemPl, paddingRight: '8px' }}
                >
                  <MessageSquare size={10} className="shrink-0 text-[#aaa]" />
                  <span className="flex-1 truncate">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(e) => onDeleteItem('chat', chat._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
              {items.notes.map((note) => (
                <div
                  key={note._id}
                  onClick={() => onNavigateItem(project, 'note', note._id)}
                  className="group flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors"
                  style={{ paddingLeft: itemPl, paddingRight: '8px' }}
                >
                  <BookOpen size={10} className="shrink-0 text-[#aaa]" />
                  <span className="flex-1 truncate">{note.title || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={(e) => onDeleteItem('note', note._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
              {rootInlineFiles.map((file) => (
                <ProjectFileTreeNode
                  key={file._id}
                  file={file}
                  allFiles={items.files}
                  depth={0}
                  baseIndentPx={itemPlPx}
                  legacyInline
                  expandedIds={expandedFileIds}
                  onToggleFolder={toggleInlineFileFolder}
                  onOpenFile={(id) => {
                    const target = items.files.find((candidate) => candidate._id === id)
                    onNavigateItem(project, target && opensInDocumentEditor(target) ? 'note' : 'file', id)
                  }}
                  onDeleteFile={handleDeleteInlineFile}
                />
              ))}
              {children.length === 0 && items.chats.length === 0 && items.notes.length === 0 && rootInlineFiles.length === 0 && (
                <p className="text-[10px] text-[#bbb] py-1" style={{ paddingLeft: itemPl }}>Empty</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main ProjectsSidebar ─────────────────────────────────────────────────────

export default function ProjectsSidebar() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [projectDraftName, setProjectDraftName] = useState('')
  const [projectDraftInstructions, setProjectDraftInstructions] = useState('')
  const [isSavingProjectMeta, setIsSavingProjectMeta] = useState(false)

  // New project inline form
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // + dropdown menu
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Hidden file inputs for upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Project items (detail view)
  const [projectChats, setProjectChats] = useState<ProjectChat[]>([])
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([])
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
  const [confirmDeleteChat, setConfirmDeleteChat] = useState<{ id: string; title: string } | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [expandedProjFolderIds, setExpandedProjFolderIds] = useState<Set<string>>(new Set())
  const [projectUploadError, setProjectUploadError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/app/projects')
      if (res.ok) setProjects(await res.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  // Close + menu on outside click
  useEffect(() => {
    if (!addMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [addMenuOpen])

  const loadProjectItems = useCallback(async (projectId: string) => {
    setItemsLoading(true)
    try {
      const [chatsRes, notesRes, filesRes] = await Promise.all([
        fetch(`/api/app/conversations?projectId=${projectId}`),
        fetch(`/api/app/files?kind=note&projectId=${projectId}`),
        fetch(`/api/app/files?projectId=${projectId}`),
      ])
      if (chatsRes.ok) setProjectChats(await chatsRes.json())
      if (notesRes.ok) {
        const notes = await notesRes.json()
        setProjectNotes(Array.isArray(notes)
          ? notes.map((note: ProjectFile) => ({ _id: note._id, title: note.name || 'Untitled', updatedAt: 0 }))
          : [])
      }
      if (filesRes.ok) {
        const files = await filesRes.json()
        setProjectFiles(Array.isArray(files) ? files.filter((file: ProjectFile) => file.kind !== 'note') : [])
      }
    } catch { /* ignore */ } finally { setItemsLoading(false) }
  }, [])

  useEffect(() => {
    setExpandedProjFolderIds(new Set())
    if (selectedProject) loadProjectItems(selectedProject._id)
  }, [selectedProject, loadProjectItems])

  useEffect(() => {
    if (!selectedProject) {
      setProjectDraftName('')
      setProjectDraftInstructions('')
      return
    }
    setProjectDraftName(selectedProject.name)
    setProjectDraftInstructions(selectedProject.instructions ?? '')
  }, [selectedProject])

  useEffect(() => {
    if (!selectedProject) return
    const latest = projects.find((project) => project._id === selectedProject._id)
    if (!latest) return
    if (
      latest.name !== selectedProject.name ||
      (latest.instructions ?? '') !== (selectedProject.instructions ?? '') ||
      latest.parentId !== selectedProject.parentId
    ) {
      setSelectedProject(latest)
    }
  }, [projects, selectedProject])

  useEffect(() => {
    function handleChatTitleUpdated(event: Event) {
      const { detail } = event as CustomEvent<ChatTitleUpdatedDetail>
      if (!detail?.chatId || !detail.title) return
      setProjectChats((prev) => {
        let changed = false
        const next = prev.map((chat) => {
          if (chat._id !== detail.chatId) return chat
          changed = true
          return { ...chat, title: detail.title }
        })
        return changed ? next : prev
      })
    }
    window.addEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
    return () => window.removeEventListener(CHAT_TITLE_UPDATED_EVENT, handleChatTitleUpdated)
  }, [])

  function openNewProjectForm(parentId: string | null) {
    setNewProjectParentId(parentId)
    setShowNewProject(true)
    setAddMenuOpen(false)
  }

  async function handleCreateProject() {
    const name = newProjectName.trim()
    if (!name || isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/app/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: newProjectParentId }),
      })
      if (res.ok) {
        setNewProjectName('')
        setShowNewProject(false)
        await loadProjects()
      }
    } finally { setIsCreating(false) }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/projects?projectId=${id}`, { method: 'DELETE' })
    if (selectedProject?._id === id) setSelectedProject(null)
    setProjects((prev) => prev.filter((p) => p._id !== id))
  }

  function handleProjectRenamed(projectId: string, name: string) {
    setProjects((prev) => prev.map((p) => (p._id === projectId ? { ...p, name } : p)))
    setSelectedProject((prev) => (prev && prev._id === projectId ? { ...prev, name } : prev))
  }

  async function handleSaveProjectMeta() {
    if (!selectedProject || isSavingProjectMeta) return
    const name = projectDraftName.trim()
    if (!name) return
    setIsSavingProjectMeta(true)
    try {
      const res = await fetch('/api/app/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject._id,
          name,
          instructions: projectDraftInstructions.trim() || undefined,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { project?: Project }
      if (data.project) {
        setProjects((prev) => prev.map((project) => (project._id === data.project!._id ? data.project! : project)))
        setSelectedProject(data.project)
      } else {
        await loadProjects()
      }
    } finally {
      setIsSavingProjectMeta(false)
    }
  }

  function toggleExpanded(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleNavigate(project: Project) {
    const pn = encodeURIComponent(project.name)
    router.push(`/app/projects?projectId=${encodeURIComponent(project._id)}&projectName=${pn}`)
    setSelectedProject(null)
    setExpandedIds((prev) => new Set([...prev, project._id]))
  }

  function projectNav(view: string, id: string, project?: Project) {
    const p = project ?? selectedProject
    if (!p) return
    const pn = encodeURIComponent(p.name)
    router.push(`/app/projects?view=${view}&id=${id}&projectId=${p._id}&projectName=${pn}`)
  }

  function handleNavigateItem(project: Project, view: string, id: string) {
    projectNav(view, id, project)
  }

  async function handleDeleteItem(type: 'chat' | 'note', id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (type === 'chat') {
      const chat = projectChats.find((c) => c._id === id)
      setConfirmDeleteChat({ id, title: chat?.title ?? '' })
      return
    } else if (type === 'note') {
      await fetch(`/api/app/files?fileId=${id}`, { method: 'DELETE' })
      setProjectNotes((prev) => prev.filter((n) => n._id !== id))
    }
  }

  async function handleDeleteFile(fileId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/files?fileId=${fileId}`, { method: 'DELETE' })
    setProjectFiles((prev) => prev.filter((f) => f._id !== fileId))
  }

  async function handleNewChat() {
    if (!selectedProject) return
    setAddMenuOpen(false)
    const models = readNewChatModelFieldsFromStorage()
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Chat',
        projectId: selectedProject._id,
        askModelIds: models.askModelIds,
        actModelId: models.actModelId,
        lastMode: models.lastMode,
      }),
    })
    if (res.ok) {
      const { id } = await res.json()
      projectNav('chat', id)
      await loadProjectItems(selectedProject._id)
    }
  }

  async function handleNewNote() {
    if (!selectedProject) return
    setAddMenuOpen(false)
    const res = await fetch('/api/app/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', name: 'Untitled', textContent: '', projectId: selectedProject._id }),
    })
    if (res.ok) {
      const { id } = await res.json()
      projectNav('note', id)
      await loadProjectItems(selectedProject._id)
    }
  }

  function toggleProjFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedProjFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function postProjectFile(
    file: File,
    parentId: string | null,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!selectedProject) return { ok: false, error: 'No project' }
    const pid = selectedProject._id
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const kind = getFileType(file.name)

    try {
      if (
        ext === 'pdf' ||
        ext === 'docx' ||
        file.type === 'application/pdf' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const form = new FormData()
        form.append('file', file)
        form.append('projectId', pid)
        if (parentId) form.append('parentId', parentId)
        const res = await fetch('/api/app/files/ingest-document', { method: 'POST', body: form })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: err.error ?? 'Could not index document' }
        }
        return { ok: true }
      }

      if (kind === 'image' || kind === 'video' || kind === 'audio') {
        const urlRes = await fetch('/api/app/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sizeBytes: file.size, mimeType: file.type || undefined }),
        })
        if (!urlRes.ok) {
          const err = (await urlRes.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: err.error ?? 'Could not get upload URL' }
        }
        const { uploadUrl, r2Key } = (await urlRes.json()) as { uploadUrl: string; r2Key: string }
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!uploadRes.ok) return { ok: false, error: 'Storage upload failed' }
        const res = await fetch('/api/app/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: 'file',
            parentId,
            r2Key,
            sizeBytes: file.size,
            projectId: pid,
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: err.error ?? 'Failed to save file' }
        }
        return { ok: true }
      }

      const content = await file.text()
      const res = await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          type: 'file',
          parentId,
          content,
          projectId: pid,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        return { ok: false, error: err.error ?? 'Failed to save file' }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' }
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedProject) return
    setAddMenuOpen(false)
    setProjectUploadError(null)
    const r = await postProjectFile(file, null)
    if (!r.ok) setProjectUploadError(r.error ?? 'Upload failed')
    await loadProjectItems(selectedProject._id)
    e.target.value = ''
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !selectedProject) return
    setAddMenuOpen(false)
    setProjectUploadError(null)
    const folders = new Map<string, string>()
    let lastError: string | null = null

    for (const file of Array.from(files)) {
      const parts = file.webkitRelativePath.split('/')
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join('/')
        if (!folders.has(folderPath)) {
          const parentPath = i === 0 ? null : parts.slice(0, i).join('/')
          const parentId = parentPath ? (folders.get(parentPath) ?? null) : null
          const res = await fetch('/api/app/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: parts[i],
              type: 'folder',
              parentId,
              projectId: selectedProject._id,
            }),
          })
          if (res.ok) {
            const { id } = await res.json()
            folders.set(folderPath, id)
          } else {
            const err = (await res.json().catch(() => ({}))) as { error?: string }
            lastError = err.error ?? 'Could not create folder'
          }
        }
      }
      const parentFolderPath = parts.slice(0, -1).join('/')
      const parentId = folders.get(parentFolderPath) ?? null
      const r = await postProjectFile(file, parentId)
      if (!r.ok) lastError = r.error ?? 'File upload failed'
    }

    if (lastError) setProjectUploadError(lastError)
    await loadProjectItems(selectedProject._id)
    e.target.value = ''
  }

  const rootProjects = projects.filter((p) => p.parentId == null)
  const subprojects = selectedProject ? projects.filter((p) => p.parentId === selectedProject._id) : []
  const rootProjectFiles = projectFiles
    .filter((f) => f.parentId == null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadFile} />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadFolder}
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
      />

      {/* Header */}
      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3 gap-2 shrink-0">
        {selectedProject ? (
          <>
            <button
              onClick={() => setSelectedProject(null)}
              className="p-1 rounded hover:bg-[#e8e8e8] transition-colors shrink-0"
            >
              <ArrowLeft size={13} className="text-[#525252]" />
            </button>
            <span className="flex-1 text-sm font-medium text-[#0a0a0a] truncate">{selectedProject.name}</span>
            <div ref={addMenuRef} className="relative shrink-0">
              <button
                onClick={() => setAddMenuOpen((v) => !v)}
                className="flex items-center justify-center w-6 h-6 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
              >
                <Plus size={13} />
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e5e5e5] rounded-lg shadow-lg py-1 z-50">
                  <button onClick={handleNewChat} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <MessageSquare size={12} />New Chat
                  </button>
                  <button onClick={handleNewNote} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <BookOpen size={12} />New Note
                  </button>
                  <button onClick={() => { setAddMenuOpen(false); fileInputRef.current?.click() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <Upload size={12} />Upload File
                  </button>
                  <button onClick={() => { setAddMenuOpen(false); folderInputRef.current?.click() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <FolderPlus size={12} />Upload Folder
                  </button>
                  <div className="border-t border-[#f0f0f0] mt-1 pt-1">
                    <button onClick={() => openNewProjectForm(selectedProject._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                      <Folder size={12} />New Subproject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => openNewProjectForm(null)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
          >
            <Plus size={13} />
            New Project
          </button>
        )}
      </div>

      {/* Inline new project form */}
      {showNewProject && (
        <div className="px-3 py-2 border-b border-[#e5e5e5] bg-[#fafafa]">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#aaa] mb-1.5">
            {newProjectParentId ? 'New Subproject' : 'New Project'}
          </p>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateProject()
              if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName('') }
            }}
            className="w-full text-xs border border-[#e5e5e5] rounded-md px-2 py-1.5 outline-none placeholder-[#aaa] focus:border-[#0a0a0a] transition-colors bg-white"
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={() => { setShowNewProject(false); setNewProjectName('') }}
              className="flex-1 py-1 rounded text-xs text-[#525252] hover:bg-[#e8e8e8] transition-colors"
            >Cancel</button>
            <button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
              className="flex-1 py-1 rounded text-xs bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#222] transition-colors"
            >{isCreating ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      )}

      {selectedProject && projectUploadError && (
        <div className="shrink-0 px-2 py-2 text-[10px] text-red-600 bg-red-50 border-b border-red-100 leading-snug">
          {projectUploadError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {loading ? (
          <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
        ) : selectedProject ? (
          itemsLoading ? (
            <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
          ) : (
            <div className="space-y-0.5">
              <div className="mx-1 mb-3 rounded-xl border border-[#e8e8e8] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#a1a1aa]">
                      Project
                    </p>
                    <input
                      value={projectDraftName}
                      onChange={(e) => setProjectDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void handleSaveProjectMeta()
                        }
                      }}
                      className="mt-1 w-full bg-transparent text-sm font-medium text-[#0a0a0a] outline-none placeholder-[#bbb]"
                      placeholder="Project name"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveProjectMeta()}
                    disabled={isSavingProjectMeta || !projectDraftName.trim()}
                    className="shrink-0 rounded-md bg-[#0a0a0a] px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-[#222] disabled:opacity-40"
                  >
                    {isSavingProjectMeta ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#a1a1aa]">
                    Instructions
                  </p>
                  <textarea
                    value={projectDraftInstructions}
                    onChange={(e) => setProjectDraftInstructions(e.target.value)}
                    className="min-h-[92px] w-full resize-y rounded-lg border border-[#ececec] bg-[#fafafa] px-2.5 py-2 text-xs text-[#303030] outline-none transition-colors placeholder-[#b2b2b2] focus:border-[#0a0a0a]"
                    placeholder="Guidance that should apply to chats and notes in this project."
                  />
                </div>
              </div>

              {/* Subprojects */}
              {subprojects.map((sub) => (
                <div
                  key={sub._id}
                  onClick={() => handleNavigate(sub)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors"
                >
                  <div className={TREE_CHEVRON_COL} aria-hidden />
                  <div className={TREE_ICON_COL}>
                    <Folder size={12} />
                  </div>
                  <span className="flex-1 truncate">{sub.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteProject(sub._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {projectChats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => projectNav('chat', chat._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <div className={TREE_CHEVRON_COL} aria-hidden />
                  <div className={TREE_ICON_COL}>
                    <MessageSquare size={12} />
                  </div>
                  <span className="flex-1 truncate">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem('chat', chat._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {projectNotes.map((note) => (
                <div
                  key={note._id}
                  onClick={() => projectNav('note', note._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <div className={TREE_CHEVRON_COL} aria-hidden />
                  <div className={TREE_ICON_COL}>
                    <BookOpen size={12} />
                  </div>
                  <span className="flex-1 truncate">{note.title || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem('note', note._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {rootProjectFiles.map((file) => (
                <ProjectFileTreeNode
                  key={file._id}
                  file={file}
                  allFiles={projectFiles}
                  depth={0}
                  baseIndentPx={TREE_GUTTER_PX}
                  expandedIds={expandedProjFolderIds}
                  onToggleFolder={toggleProjFolder}
                  onOpenFile={(id) => {
                    const target = projectFiles.find((candidate) => candidate._id === id)
                    projectNav(target && opensInDocumentEditor(target) ? 'note' : 'file', id)
                  }}
                  onDeleteFile={handleDeleteFile}
                />
              ))}
              {subprojects.length === 0 && projectChats.length === 0 && projectNotes.length === 0 && projectFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#aaa] text-center">
                  <FolderOpen size={28} strokeWidth={1} className="opacity-40" />
                  <p className="text-xs">Empty project</p>
                  <p className="text-[10px]">Use + to add items</p>
                </div>
              )}
            </div>
          )
        ) : (
          rootProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#aaa] text-center">
              <FolderOpen size={28} strokeWidth={1} className="opacity-40" />
              <p className="text-xs">No projects yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootProjects.map((project) => (
                <ProjectNode
                  key={project._id}
                  project={project}
                  allProjects={projects}
                  depth={0}
                  selectedId={null}
                  expandedIds={expandedIds}
                  onNavigate={handleNavigate}
                  onToggle={toggleExpanded}
                  onDelete={handleDeleteProject}
                  onNavigateItem={handleNavigateItem}
                  onDeleteItem={handleDeleteItem}
                  onProjectRenamed={handleProjectRenamed}
                />
              ))}
            </div>
          )
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmDeleteChat !== null}
        title="Delete chat?"
        description={confirmDeleteChat ? `“${confirmDeleteChat.title || 'Untitled chat'}” will be permanently deleted. This can’t be undone.` : undefined}
        confirmLabel="Delete"
        onConfirm={async () => {
          const target = confirmDeleteChat
          if (!target) return
          setConfirmDeleteChat(null)
          dispatchChatDeleted({ chatId: target.id })
          await fetch(`/api/app/conversations?conversationId=${target.id}`, { method: 'DELETE' })
          setProjectChats((prev) => prev.filter((c) => c._id !== target.id))
        }}
        onCancel={() => setConfirmDeleteChat(null)}
      />
    </div>
  )
}
