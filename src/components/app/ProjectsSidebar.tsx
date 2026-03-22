'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, FolderOpen, Folder, ChevronRight, MessageSquare,
  BookOpen, FileText, Upload, FolderPlus, Loader2, Trash2, ArrowLeft,
} from 'lucide-react'
import { CHAT_TITLE_UPDATED_EVENT, type ChatTitleUpdatedDetail } from '@/lib/chat-title'
import { readFileAsContent } from './FileViewer'

interface Project {
  _id: string
  name: string
  parentId: string | null
  createdAt: number
  updatedAt: number
}

interface ProjectChat { _id: string; title: string; lastModified: number }
interface ProjectNote { _id: string; title: string; updatedAt: number }
interface ProjectFile { _id: string; name: string; type: 'file' | 'folder'; parentId: string | null }
// ─── Project tree node ────────────────────────────────────────────────────────

function ProjectNode({
  project, allProjects, depth, selectedId, expandedIds, onNavigate, onToggle, onDelete, onNavigateItem, onDeleteItem,
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
}) {
  const children = allProjects.filter((p) => p.parentId === project._id)
  const isOpen = expandedIds.has(project._id)
  const isSelected = project._id === selectedId

  // Inline items loaded on-demand when expanded
  const [items, setItems] = useState<{ chats: ProjectChat[]; notes: ProjectNote[] } | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || items !== null) return
    let cancelled = false
    async function load() {
      setItemsLoading(true)
      try {
        const [cr, nr] = await Promise.all([
          fetch(`/api/app/conversations?projectId=${project._id}`),
          fetch(`/api/app/notes?projectId=${project._id}`),
        ])
        if (cancelled) return
        const [chats, notes] = await Promise.all([
          cr.ok ? cr.json() : [],
          nr.ok ? nr.json() : [],
        ])
        if (!cancelled) setItems({ chats, notes })
      } finally {
        if (!cancelled) setItemsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, project._id, items])

  const itemPl = `${depth * 16 + 28}px`

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
          isSelected ? 'bg-[#e8e8e8] text-[#0a0a0a]' : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
        onClick={() => onNavigate(project)}
      >
        {/* Chevron always visible — toggles inline expansion */}
        <button
          onClick={(e) => onToggle(project._id, e)}
          className="shrink-0 p-0.5 rounded hover:bg-[#d8d8d8] transition-colors"
        >
          <ChevronRight size={10} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen
          ? <FolderOpen size={12} className="shrink-0 text-[#888]" />
          : <Folder size={12} className="shrink-0 text-[#888]" />
        }
        <span className="flex-1 truncate">{project.name}</span>
        <button
          onClick={(e) => onDelete(project._id, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {isOpen && (
        <>
          {/* Subprojects */}
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
            />
          ))}

          {/* Inline items */}
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
                    onClick={(e) => onDeleteItem('note', note._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
              {children.length === 0 && items.chats.length === 0 && items.notes.length === 0 && (
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
  const [itemsLoading, setItemsLoading] = useState(false)

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
        fetch(`/api/app/notes?projectId=${projectId}`),
        fetch(`/api/app/files?projectId=${projectId}`),
      ])
      if (chatsRes.ok) setProjectChats(await chatsRes.json())
      if (notesRes.ok) setProjectNotes(await notesRes.json())
      if (filesRes.ok) setProjectFiles(await filesRes.json())
    } catch { /* ignore */ } finally { setItemsLoading(false) }
  }, [])

  useEffect(() => {
    if (selectedProject) loadProjectItems(selectedProject._id)
  }, [selectedProject, loadProjectItems])

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

  function toggleExpanded(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleNavigate(project: Project) {
    setSelectedProject(project)
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
      await fetch(`/api/app/conversations?conversationId=${id}`, { method: 'DELETE' })
      setProjectChats((prev) => prev.filter((c) => c._id !== id))
    } else if (type === 'note') {
      await fetch(`/api/app/notes?noteId=${id}`, { method: 'DELETE' })
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
    const res = await fetch('/api/app/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Chat',
        projectId: selectedProject._id,
        askModelIds: ['claude-sonnet-4-6'],
        actModelId: 'claude-sonnet-4-6',
        lastMode: 'ask',
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
    const res = await fetch('/api/app/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', tags: [], projectId: selectedProject._id }),
    })
    if (res.ok) {
      const { id } = await res.json()
      projectNav('note', id)
      await loadProjectItems(selectedProject._id)
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedProject) return
    setAddMenuOpen(false)
    const content = await readFileAsContent(file)
    await fetch('/api/app/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, type: 'file', parentId: null, content, projectId: selectedProject._id }),
    })
    await loadProjectItems(selectedProject._id)
    e.target.value = ''
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !selectedProject) return
    setAddMenuOpen(false)
    const folders = new Map<string, string>()
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
            body: JSON.stringify({ name: parts[i], type: 'folder', parentId, projectId: selectedProject._id }),
          })
          if (res.ok) { const { id } = await res.json(); folders.set(folderPath, id) }
        }
      }
      const content = await readFileAsContent(file)
      const parentFolderPath = parts.slice(0, -1).join('/')
      const parentId = folders.get(parentFolderPath) ?? null
      await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parts[parts.length - 1], type: 'file', parentId, content, projectId: selectedProject._id }),
      })
    }
    await loadProjectItems(selectedProject._id)
    e.target.value = ''
  }

  const rootProjects = projects.filter((p) => p.parentId == null)
  const subprojects = selectedProject ? projects.filter((p) => p.parentId === selectedProject._id) : []
  const rootProjectFiles = projectFiles.filter((f) => f.parentId == null)

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {loading ? (
          <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
        ) : selectedProject ? (
          itemsLoading ? (
            <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
          ) : (
            <div className="space-y-0.5">
              {/* Subprojects */}
              {subprojects.map((sub) => (
                <div
                  key={sub._id}
                  onClick={() => handleNavigate(sub)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors"
                >
                  <Folder size={12} className="shrink-0 text-[#888]" />
                  <span className="flex-1 truncate">{sub.name}</span>
                  <button
                    onClick={(e) => handleDeleteProject(sub._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {/* Chats */}
              {projectChats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => projectNav('chat', chat._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <MessageSquare size={12} className="shrink-0 text-[#888]" />
                  <span className="flex-1 truncate">{chat.title}</span>
                  <button
                    onClick={(e) => handleDeleteItem('chat', chat._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {/* Notes */}
              {projectNotes.map((note) => (
                <div
                  key={note._id}
                  onClick={() => projectNav('note', note._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <BookOpen size={12} className="shrink-0 text-[#888]" />
                  <span className="flex-1 truncate">{note.title || 'Untitled'}</span>
                  <button
                    onClick={(e) => handleDeleteItem('note', note._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {/* Files */}
              {rootProjectFiles.map((file) => (
                <div
                  key={file._id}
                  onClick={() => file.type === 'file' && projectNav('file', file._id)}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] transition-colors ${file.type === 'file' ? 'cursor-pointer hover:bg-[#ebebeb] hover:text-[#0a0a0a]' : ''}`}
                >
                  {file.type === 'folder'
                    ? <Folder size={12} className="shrink-0 text-[#888]" />
                    : <FileText size={12} className="shrink-0 text-[#888]" />}
                  <span className="flex-1 truncate">{file.name}</span>
                  <button
                    onClick={(e) => handleDeleteFile(file._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
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
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
