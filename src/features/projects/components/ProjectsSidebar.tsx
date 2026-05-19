'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderOpen, Folder, ChevronRight, MessageSquare,
  BookOpen, Loader2, Trash2, Pencil,
} from 'lucide-react'
import { CHAT_TITLE_UPDATED_EVENT, dispatchChatDeleted, type ChatTitleUpdatedDetail } from '@/shared/chat/chat-title'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  ProjectFileTreeNode,
  type Project,
  type ProjectChat,
  type ProjectNote,
  type ProjectFile,
} from '@/features/projects/components/ProjectFileTree'
import { readNewChatModelFieldsFromStorage } from '@/shared/chat/chat-model-prefs'
import {
  PROJECT_META_UPDATED_EVENT,
  createProjectFolderRequest,
  createProjectNoteRequest,
  createProjectStoredFileRequest,
  createProjectTextFileRequest,
  projectFilesExcludingNotes,
  projectHubHref,
  projectItemHref,
  projectNotesFromFiles,
  projectRouteViewForFile,
  removeProjectFromList,
  renameProjectInList,
  rootProjectFiles,
  rootProjects as getRootProjects,
  shouldIngestProjectDocument,
  shouldUseProjectStorageUpload,
  updateProjectInList,
  childProjects,
} from '@overlay/app-core'
import { ProjectsSidebarFrame } from '@overlay/modules-react/projects'
import { overlayAppClient } from '@/shared/app/overlay-app-client'

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
  onNavigateItem: (project: Project, view: 'chat' | 'note' | 'file', id: string) => void
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
        const [chats, notes, files] = await Promise.all([
          overlayAppClient.conversations.get<ProjectChat[]>({ projectId: project._id }),
          overlayAppClient.files.get<ProjectFile[]>({ kind: 'note', projectId: project._id }),
          overlayAppClient.files.get<ProjectFile[]>({ projectId: project._id }),
        ])
        if (cancelled) return
        const noteRows = Array.isArray(notes) ? projectNotesFromFiles(notes) : []
        const fileRows = Array.isArray(files) ? projectFilesExcludingNotes(files) : []
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
    await overlayAppClient.files.deleteResponse({ fileId })
    setItems((prev) => (prev ? { ...prev, files: prev.files.filter((f) => f._id !== fileId) } : null))
  }

  const rootInlineFiles = items ? rootProjectFiles(items.files) : []

  async function commitProjectRowRename() {
    if (renamingProjectId !== project._id) return
    const name = renameDraft.trim()
    setRenamingProjectId(null)
    if (!name || name === project.name) return
    try {
      const res = await overlayAppClient.projects.updateResponse({ projectId: project._id, name })
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
                    onNavigateItem(project, target ? projectRouteViewForFile(target) : 'file', id)
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
      setProjects(await overlayAppClient.projects.get<Project[]>())
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
      const [chats, notes, files] = await Promise.all([
        overlayAppClient.conversations.get<ProjectChat[]>({ projectId }),
        overlayAppClient.files.get<ProjectFile[]>({ kind: 'note', projectId }),
        overlayAppClient.files.get<ProjectFile[]>({ projectId }),
      ])
      setProjectChats(Array.isArray(chats) ? chats : [])
      setProjectNotes(Array.isArray(notes) ? projectNotesFromFiles(notes) : [])
      setProjectFiles(Array.isArray(files) ? projectFilesExcludingNotes(files) : [])
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
      const res = await overlayAppClient.projects.createResponse({ name, parentId: newProjectParentId })
      if (res.ok) {
        setNewProjectName('')
        setShowNewProject(false)
        await loadProjects()
      }
    } finally { setIsCreating(false) }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await overlayAppClient.projects.deleteResponse({ projectId: id })
    if (selectedProject?._id === id) setSelectedProject(null)
    setProjects((prev) => removeProjectFromList(prev, id))
  }

  function handleProjectRenamed(projectId: string, name: string) {
    setProjects((prev) => renameProjectInList(prev, projectId, name))
    setSelectedProject((prev) => (prev && prev._id === projectId ? { ...prev, name } : prev))
  }

  async function handleSaveProjectMeta() {
    if (!selectedProject || isSavingProjectMeta) return
    const name = projectDraftName.trim()
    if (!name) return
    setIsSavingProjectMeta(true)
    try {
      const res = await overlayAppClient.projects.updateResponse({
        projectId: selectedProject._id,
        name,
        instructions: projectDraftInstructions.trim() || undefined,
      })
      if (!res.ok) return
      const data = (await res.json()) as { project?: Project }
      if (data.project) {
        setProjects((prev) => updateProjectInList(prev, data.project!))
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
    router.push(projectHubHref(project))
    setSelectedProject(null)
    setExpandedIds((prev) => new Set([...prev, project._id]))
  }

  function projectNav(view: 'chat' | 'note' | 'file', id: string, project?: Project) {
    const p = project ?? selectedProject
    if (!p) return
    router.push(projectItemHref({ project: p, view, id }))
  }

  function handleNavigateItem(project: Project, view: 'chat' | 'note' | 'file', id: string) {
    projectNav(view, id, project)
  }

  async function handleDeleteItem(type: 'chat' | 'note', id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (type === 'chat') {
      const chat = projectChats.find((c) => c._id === id)
      setConfirmDeleteChat({ id, title: chat?.title ?? '' })
      return
    } else if (type === 'note') {
      await overlayAppClient.files.deleteResponse({ fileId: id })
      setProjectNotes((prev) => prev.filter((n) => n._id !== id))
    }
  }

  async function handleDeleteFile(fileId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await overlayAppClient.files.deleteResponse({ fileId })
    setProjectFiles((prev) => prev.filter((f) => f._id !== fileId))
  }

  async function handleNewChat() {
    if (!selectedProject) return
    setAddMenuOpen(false)
    const models = readNewChatModelFieldsFromStorage()
    const res = await overlayAppClient.conversations.createResponse({
      title: 'New Chat',
      projectId: selectedProject._id,
      askModelIds: models.askModelIds,
      actModelId: models.actModelId,
      lastMode: models.lastMode,
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
    const res = await overlayAppClient.files.createResponse(createProjectNoteRequest(selectedProject._id))
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

    try {
      if (shouldIngestProjectDocument(file)) {
        const form = new FormData()
        form.append('file', file)
        form.append('projectId', pid)
        if (parentId) form.append('parentId', parentId)
        const res = await overlayAppClient.files.ingestDocumentResponse(form)
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: err.error ?? 'Could not index document' }
        }
        return { ok: true }
      }

      if (shouldUseProjectStorageUpload(file)) {
        const urlRes = await overlayAppClient.files.uploadUrlResponse({ sizeBytes: file.size, mimeType: file.type || undefined })
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
        const res = await overlayAppClient.files.createResponse(createProjectStoredFileRequest({
          file,
          parentId,
          projectId: pid,
          r2Key,
        }))
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          return { ok: false, error: err.error ?? 'Failed to save file' }
        }
        return { ok: true }
      }

      const content = await file.text()
      const res = await overlayAppClient.files.createResponse(createProjectTextFileRequest({
        file,
        parentId,
        projectId: pid,
        content,
      }))
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
          const res = await overlayAppClient.files.createResponse(createProjectFolderRequest({
            name: parts[i] ?? 'Folder',
            parentId,
            projectId: selectedProject._id,
          }))
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

  const rootProjectRows = getRootProjects(projects)
  const subprojects = selectedProject ? childProjects(projects, selectedProject._id) : []
  const rootProjectFileRows = rootProjectFiles(projectFiles)

  return (
    <>
      <ProjectsSidebarFrame
        selectedProject={selectedProject}
        loading={loading}
        itemsLoading={itemsLoading}
        rootProjects={rootProjectRows}
        subprojects={subprojects}
        projectChats={projectChats}
        projectNotes={projectNotes}
        rootProjectFiles={rootProjectFileRows}
        allProjectFiles={projectFiles}
        expandedProjectIds={expandedIds}
        expandedFileIds={expandedProjFolderIds}
        showNewProject={showNewProject}
        newProjectParentId={newProjectParentId}
        newProjectName={newProjectName}
        creatingProject={isCreating}
        addMenuOpen={addMenuOpen}
        addMenuRef={addMenuRef}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        projectUploadError={projectUploadError}
        projectDraftName={projectDraftName}
        projectDraftInstructions={projectDraftInstructions}
        savingProjectMeta={isSavingProjectMeta}
        renderRootProject={(project) => (
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
        )}
        onBack={() => setSelectedProject(null)}
        onToggleAddMenu={() => setAddMenuOpen((value) => !value)}
        onOpenNewProjectForm={openNewProjectForm}
        onCancelNewProject={() => { setShowNewProject(false); setNewProjectName('') }}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={() => void handleCreateProject()}
        onCreateChat={() => void handleNewChat()}
        onCreateNote={() => void handleNewNote()}
        onUploadFile={handleUploadFile}
        onUploadFolder={handleUploadFolder}
        onProjectDraftNameChange={setProjectDraftName}
        onProjectDraftInstructionsChange={setProjectDraftInstructions}
        onSaveProjectMeta={() => void handleSaveProjectMeta()}
        onOpenSubproject={handleNavigate}
        onDeleteProject={handleDeleteProject}
        onOpenProjectChat={(id) => projectNav('chat', id)}
        onOpenProjectNote={(id) => projectNav('note', id)}
        onDeleteItem={handleDeleteItem}
        onToggleFileFolder={toggleProjFolder}
        onOpenProjectFile={(id) => {
          const target = projectFiles.find((candidate) => candidate._id === id)
          projectNav(target ? projectRouteViewForFile(target) : 'file', id)
        }}
        onDeleteProjectFile={handleDeleteFile}
      />
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
          await overlayAppClient.conversations.deleteResponse({ conversationId: target.id })
          setProjectChats((prev) => prev.filter((c) => c._id !== target.id))
        }}
        onCancel={() => setConfirmDeleteChat(null)}
      />
    </>
  )
}
