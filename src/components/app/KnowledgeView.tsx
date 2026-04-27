'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Brain, Trash2, Plus, X, FilePlus, FolderPlus, FolderInput, Copy, Check,
  ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Search,
  LayoutList, LayoutGrid, RefreshCw, SquareMousePointer, Loader2,
  PanelRight, Maximize2,
} from 'lucide-react'
import { FileTreeSkeleton, KnowledgeListSkeleton } from '@/components/ui/Skeleton'
import posthog from 'posthog-js'
import { FileViewerPanel, getFileType, isEditableType } from './FileViewer'
import OutputsView from './OutputsView'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryListItem {
  key: string
  memoryId: string
  segmentIndex: number
  content: string
  fullContent: string
  source: string
  createdAt: number
}

interface FileNode {
  _id: string
  name: string
  type: 'file' | 'folder'
  parentId: string | null
  content?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  downloadUrl?: string
  createdAt: number
  updatedAt: number
}

type Tab = 'memories' | 'files' | 'outputs'

type OutputFilter = 'all' | 'image' | 'video' | 'files'

const OUTPUT_FILTER_LABELS: Record<OutputFilter, string> = {
  all: 'All',
  image: 'Image',
  video: 'Video',
  files: 'Files',
}

const TOOLBAR_ICON_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

const TOOLBAR_FILLED_BUTTON_CLASS =
  'flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]'

const DIALOG_ACTION_BUTTON_CLASS =
  'px-3 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] transition-colors hover:bg-[var(--border)]'

const IMPORT_MEMORY_PROMPT = 'Export all of my stored memories and any context you\'ve learned about me from past conversations. Preserve my words verbatim where possible, especially for instructions and preferences.'

function filePathLabel(all: FileNode[], file: FileNode): string {
  const parts: string[] = []
  let pid: string | null = file.parentId
  while (pid) {
    const p = all.find((x) => x._id === pid)
    if (!p) break
    parts.unshift(p.name)
    pid = p.parentId
  }
  return parts.length ? parts.join(' / ') : 'Library'
}

// ─── File tree node ───────────────────────────────────────────────────────────

function FileTreeNode({
  node, allNodes, depth, selectedId, onSelect, onDelete,
  bulkSelectMode = false,
  bulkSelectedIds,
  onToggleBulk,
}: {
  node: FileNode
  allNodes: FileNode[]
  depth: number
  selectedId: string | null
  onSelect: (node: FileNode) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  bulkSelectMode?: boolean
  bulkSelectedIds?: Set<string>
  onToggleBulk?: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const children = allNodes.filter((n) => n.parentId === node._id)
  const isFileViewerSelected = node.type === 'file' && node._id === selectedId
  const isBulkSelected = Boolean(bulkSelectedIds?.has(node._id))

  function handleRowClick() {
    if (bulkSelectMode && onToggleBulk) {
      onToggleBulk(node._id)
      return
    }
    if (node.type === 'folder') setOpen((v) => !v)
    else onSelect(node)
  }

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (node.type !== 'folder') return
    setOpen((v) => !v)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleRowClick()
          }
        }}
        className={`group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-muted)] ${
          isFileViewerSelected && !bulkSelectMode
            ? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]'
            : isBulkSelected
              ? 'border-[var(--border)] bg-[var(--surface-muted)]'
              : 'text-[var(--foreground)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {bulkSelectMode ? (
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] ${
              isBulkSelected ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
            }`}
            aria-hidden
          >
            {isBulkSelected ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {node.type === 'folder' ? (
            <>
              <button
                type="button"
                className="-m-0.5 shrink-0 rounded p-0.5 text-[var(--muted-light)] hover:bg-[var(--surface-subtle)]"
                onClick={handleChevronClick}
                aria-label={open ? 'Collapse folder' : 'Expand folder'}
              >
                <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
              </button>
              {open
                ? <FolderOpen size={14} className="shrink-0 text-[var(--muted-light)]" />
                : <Folder size={14} className="shrink-0 text-[var(--muted-light)]" />}
            </>
          ) : (
            <FileText size={14} className="shrink-0 text-[var(--muted-light)]" />
          )}
          <span className="min-w-0 flex-1 truncate leading-relaxed">{node.name}</span>
        </div>
        {!bulkSelectMode ? (
          <button
            type="button"
            onClick={(e) => onDelete(node._id, e)}
            className="shrink-0 rounded p-1 text-[var(--muted-light)] opacity-0 transition-opacity hover:bg-[var(--surface-subtle)] hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
      {node.type === 'folder' && open && children.map((child) => (
        <FileTreeNode
          key={child._id}
          node={child}
          allNodes={allNodes}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          bulkSelectMode={bulkSelectMode}
          bulkSelectedIds={bulkSelectedIds}
          onToggleBulk={onToggleBulk}
        />
      ))}
    </div>
  )
}

// ─── Main KnowledgeView ───────────────────────────────────────────────────────

export default function KnowledgeView({ userId: _userId }: { userId: string }) {
  void _userId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fileOpenParam = searchParams?.get('file') ?? null
  const memoryOpenParam = searchParams?.get('memory') ?? null
  const viewParam = searchParams?.get('view') ?? 'memories'
  const activeTab: Tab =
    viewParam === 'files' ? 'files' : viewParam === 'outputs' ? 'outputs' : 'memories'

  const layout: 'list' | 'cards' = useMemo(() => {
    const L = searchParams?.get('layout')
    if (L === 'cards' || L === 'list') return L
    return activeTab === 'outputs' ? 'cards' : 'list'
  }, [searchParams, activeTab])

  function updateQuery(updates: Record<string, string | null | undefined>) {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === '') p.delete(k)
      else p.set(k, v)
    }
    router.push(`${pathname}?${p.toString()}`)
  }

  const [outputsRefreshKey, setOutputsRefreshKey] = useState(0)
  const [outputFilterOpen, setOutputFilterOpen] = useState(false)
  const outputFilterRef = useRef<HTMLDivElement>(null)

  const outputFilter: OutputFilter = useMemo(() => {
    const o = searchParams?.get('out')
    if (o === 'image' || o === 'video' || o === 'files') return o
    return 'all'
  }, [searchParams])

  function commitOutputFilter(next: OutputFilter) {
    if (next === 'all') updateQuery({ out: null })
    else updateQuery({ out: next })
    setOutputFilterOpen(false)
  }

  useEffect(() => {
    if (!outputFilterOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (outputFilterRef.current && !outputFilterRef.current.contains(e.target as Node)) {
        setOutputFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [outputFilterOpen])

  // ── Memories state ──
  const [memories, setMemories] = useState<MemoryListItem[]>([])
  const [memoriesLoading, setMemoriesLoading] = useState(true)
  const [selectedMemory, setSelectedMemory] = useState<MemoryListItem | null>(null)
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [addText, setAddText] = useState('')
  const [isSavingMemory, setIsSavingMemory] = useState(false)
  const [memorySaveError, setMemorySaveError] = useState<string | null>(null)
  const [memorySavePendingPreview, setMemorySavePendingPreview] = useState<string | null>(null)
  const [showImportMemory, setShowImportMemory] = useState(false)
  const [importText, setImportText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importMemoryError, setImportMemoryError] = useState<string | null>(null)
  const [importPendingPreview, setImportPendingPreview] = useState<string | null>(null)
  const [importPromptCopied, setImportPromptCopied] = useState(false)
  const [fileUploadPending, setFileUploadPending] = useState<{ label: string } | null>(null)
  const [fileUploadError, setFileUploadError] = useState<string | null>(null)

  // ── File system state ──
  const [files, setFiles] = useState<FileNode[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [filePreviewMode, setFilePreviewMode] = useState<'dialog' | 'sidebar'>('dialog')
  const [isSavingFile, setIsSavingFile] = useState(false)
  const [dialog, setDialog] = useState<{ type: 'file' | 'folder'; parentId: string | null } | null>(null)
  const [dialogName, setDialogName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileUploadRef = useRef<HTMLInputElement>(null)
  const folderUploadRef = useRef<HTMLInputElement>(null)

  const [memorySearchOpen, setMemorySearchOpen] = useState(false)
  const [memorySearchQuery, setMemorySearchQuery] = useState('')
  const [fileSearchOpen, setFileSearchOpen] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(() => new Set())
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(() => new Set())
  const [selectedOutputIds, setSelectedOutputIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    setSelectMode(false)
    setSelectedMemoryIds(new Set())
    setSelectedFileIds(new Set())
    setSelectedOutputIds(new Set())
  }, [activeTab])

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedMemoryIds(new Set())
    setSelectedFileIds(new Set())
    setSelectedOutputIds(new Set())
  }

  function toggleMemorySelect(memoryId: string) {
    setSelectedMemoryIds((prev) => {
      const n = new Set(prev)
      if (n.has(memoryId)) n.delete(memoryId)
      else n.add(memoryId)
      return n
    })
  }

  function toggleFileBulkSelect(fileId: string) {
    setSelectedFileIds((prev) => {
      const n = new Set(prev)
      if (n.has(fileId)) n.delete(fileId)
      else n.add(fileId)
      return n
    })
  }

  function toggleOutputSelect(outputId: string) {
    setSelectedOutputIds((prev) => {
      const n = new Set(prev)
      if (n.has(outputId)) n.delete(outputId)
      else n.add(outputId)
      return n
    })
  }

  async function bulkDeleteMemories() {
    if (selectedMemoryIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedMemoryIds].map((id) =>
          fetch(`/api/app/memory?memoryId=${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ),
      )
      if (selectedMemory && selectedMemoryIds.has(selectedMemory.memoryId)) {
        setSelectedMemory(null)
        updateQuery({ memory: null })
      }
      await loadMemories()
      exitSelectMode()
    } finally {
      setBulkDeleting(false)
    }
  }

  async function bulkDeleteFiles() {
    if (selectedFileIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedFileIds].map((id) =>
          fetch(`/api/app/files?fileId=${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ),
      )
      if (selectedFile && selectedFileIds.has(selectedFile._id)) {
        setSelectedFile(null)
        setFileContent('')
        updateQuery({ file: null })
      }
      await loadFiles()
      exitSelectMode()
    } finally {
      setBulkDeleting(false)
    }
  }

  async function bulkDeleteOutputs() {
    if (selectedOutputIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedOutputIds].map((id) =>
          fetch(`/api/app/outputs?outputId=${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ),
      )
      setOutputsRefreshKey((k) => k + 1)
      exitSelectMode()
    } finally {
      setBulkDeleting(false)
    }
  }

  const loadFile = useCallback(async (fileId: string) => {
    const res = await fetch(`/api/app/files?fileId=${fileId}`)
    if (!res.ok) return
    const file = (await res.json()) as FileNode
    setSelectedFile(file)
    setFileContent(file.content ?? '')
    setFilePreviewMode('dialog')
  }, [])

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/app/memory')
      if (res.ok) setMemories((await res.json()) as MemoryListItem[])
    } catch { /* ignore */ } finally { setMemoriesLoading(false) }
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/app/files')
      if (res.ok) setFiles(await res.json())
    } catch { /* ignore */ } finally { setFilesLoading(false) }
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])
  useEffect(() => { loadFiles() }, [loadFiles])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadMemories()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadMemories])

  useEffect(() => {
    if (!fileOpenParam || filesLoading || files.length === 0) return
    const node = files.find((f) => f._id === fileOpenParam && f.type === 'file')
    if (!node) return
    void loadFile(node._id)
  }, [fileOpenParam, files, filesLoading, loadFile])

  useEffect(() => {
    if (!memoryOpenParam || memoriesLoading || memories.length === 0) return
    const mem = memories.find((m) => m.memoryId === memoryOpenParam)
    if (!mem) return
    setSelectedMemory(mem)
  }, [memoryOpenParam, memories, memoriesLoading])

  // ── Memory handlers ──
  async function handleAddMemory() {
    const text = addText.trim()
    if (!text || isSavingMemory) return
    setIsSavingMemory(true)
    setMemorySaveError(null)
    const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text
    setMemorySavePendingPreview(preview)
    try {
      const res = await fetch('/api/app/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          source: 'manual',
          type: 'fact',
          importance: 3,
          actor: 'user',
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setMemorySaveError(typeof data?.error === 'string' ? data.error : 'Could not save memory')
        return
      }
      setAddText('')
      setShowAddMemory(false)
      await loadMemories()
    } finally {
      setMemorySavePendingPreview(null)
      setIsSavingMemory(false)
    }
  }

  async function handleImportMemory() {
    const text = importText.trim()
    if (!text || isImporting) return
    setIsImporting(true)
    setImportMemoryError(null)
    const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text
    setImportPendingPreview(preview)
    try {
      const res = await fetch('/api/app/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          source: 'manual',
          type: 'fact',
          importance: 3,
          actor: 'user',
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setImportMemoryError(typeof data?.error === 'string' ? data.error : 'Could not import memory')
        return
      }
      setImportText('')
      setShowImportMemory(false)
      await loadMemories()
    } finally {
      setImportPendingPreview(null)
      setIsImporting(false)
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    const res = await fetch(`/api/app/memory?memoryId=${memoryId}`, { method: 'DELETE' })
    if (!res.ok) return
    if (selectedMemory?.memoryId === memoryId) {
      setSelectedMemory(null)
      updateQuery({ memory: null })
    }
    setMemories((prev) => prev.filter((m) => m.memoryId !== memoryId))
  }

  function openMemory(memory: MemoryListItem) {
    setSelectedMemory(memory)
    updateQuery({ view: 'memories', memory: memory.memoryId })
  }

  function closeMemoryDialog() {
    setSelectedMemory(null)
    updateQuery({ memory: null })
  }

  function closeFileDialog() {
    setSelectedFile(null)
    setFileContent('')
    setFilePreviewMode('dialog')
    updateQuery({ file: null })
  }

  // ── File handlers ──
  async function handleCreateFile() {
    const name = dialogName.trim()
    if (!name || isCreating || !dialog) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: dialog.type, parentId: dialog.parentId }),
      })
      if (res.ok) {
        posthog.capture('knowledge_file_created', { file_name: name, type: dialog.type })
        if (dialog.type === 'folder') {
          posthog.capture('knowledge_folder_created', { folder_name: name })
        }
        setDialogName(''); setDialog(null); await loadFiles()
      }
    } finally { setIsCreating(false) }
  }

  function handleSelectFile(node: FileNode) {
    void loadFile(node._id)
    updateQuery({ view: 'files', file: node._id })
  }

  async function handleDeleteNode(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = files.find((f) => f._id === id)
    const res = await fetch(`/api/app/files?fileId=${id}`, { method: 'DELETE' })
    if (res.ok && node) {
      posthog.capture('knowledge_file_deleted', { file_name: node.name, type: node.type })
    }
    if (selectedFile?._id === id) {
      setSelectedFile(null)
      setFileContent('')
      updateQuery({ file: null })
    }
    await loadFiles()
  }

  function handleFileContentChange(val: string) {
    setFileContent(val)
    if (!selectedFile) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setIsSavingFile(true)
      await fetch('/api/app/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: selectedFile._id, content: val }),
      })
      setFiles((prev) => prev.map((f) => f._id === selectedFile._id ? { ...f } : f))
      setIsSavingFile(false)
    }, 800)
  }

  async function uploadSingleFile(file: File, parentId: string | null): Promise<boolean> {
    try {
      const fileType = getFileType(file.name)
      const isText = fileType === 'text' || fileType === 'markdown' || fileType === 'csv'
      if (isText) {
        const content = await file.text()
        const res = await fetch('/api/app/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, type: 'file', parentId, content }),
        })
        return res.ok
      }
      const urlRes = await fetch('/api/app/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizeBytes: file.size, name: file.name, mimeType: file.type || undefined }),
      })
      if (!urlRes.ok) return false
      const { uploadUrl, r2Key } = await urlRes.json() as { uploadUrl: string; r2Key: string }
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadRes.ok) return false
      const createRes = await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: 'file', parentId, r2Key, sizeBytes: file.size }),
      })
      return createRes.ok
    } catch {
      return false
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileUploadError(null)
    setFileUploadPending({ label: file.name })
    try {
      const ok = await uploadSingleFile(file, null)
      if (!ok) {
        setFileUploadError('Upload failed. Check the file and try again.')
        return
      }
      await loadFiles()
    } finally {
      setFileUploadPending(null)
      e.target.value = ''
    }
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files
    if (!uploadedFiles) return
    const list = Array.from(uploadedFiles)
    setFileUploadError(null)
    setFileUploadPending({ label: list.length === 1 ? list[0]!.name : `Folder · ${list.length} files` })
    try {
      const folders = new Map<string, string>()
      for (const file of list) {
        const parts = file.webkitRelativePath.split('/')
        for (let i = 0; i < parts.length - 1; i++) {
          const folderPath = parts.slice(0, i + 1).join('/')
          if (!folders.has(folderPath)) {
            const parentPath = i === 0 ? null : parts.slice(0, i).join('/')
            const parentId = parentPath ? (folders.get(parentPath) ?? null) : null
            const res = await fetch('/api/app/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: parts[i], type: 'folder', parentId }),
            })
            if (res.ok) {
              const { id } = await res.json() as { id: string }
              folders.set(folderPath, id)
            }
          }
        }
        const parentFolderPath = parts.slice(0, -1).join('/')
        const parentId = folders.get(parentFolderPath) ?? null
        const ok = await uploadSingleFile(file, parentId)
        if (!ok) {
          setFileUploadError('One or more files failed to upload.')
          break
        }
      }
      await loadFiles()
    } finally {
      setFileUploadPending(null)
      e.target.value = ''
    }
  }

  const filesFiltered = useMemo(() => {
    const q = fileSearchQuery.trim().toLowerCase()
    if (!q) return files
    const keep = new Set<string>()
    for (const n of files) {
      if (n.type === 'file' && n.name.toLowerCase().includes(q)) {
        keep.add(n._id)
        let p = n.parentId
        while (p) {
          keep.add(p)
          p = files.find((x) => x._id === p)?.parentId ?? null
        }
      }
    }
    return files.filter((f) => keep.has(f._id))
  }, [files, fileSearchQuery])

  const memoriesFiltered = useMemo(() => {
    const q = memorySearchQuery.trim().toLowerCase()
    if (!q) return memories
    return memories.filter(
      (m) => m.fullContent.toLowerCase().includes(q) || m.content.toLowerCase().includes(q),
    )
  }, [memories, memorySearchQuery])

  const rootNodes = filesFiltered.filter((f) => f.parentId === null)

  const flatFilesSorted = useMemo(
    () =>
      filesFiltered
        .filter((f) => f.type === 'file')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [filesFiltered],
  )

  return (
    <div className="flex flex-col h-full">
      {/* ── Add memory modal ── */}
      {showAddMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddMemory(false)
              setAddText('')
              setMemorySaveError(null)
            }
          }}
        >
          <div className="w-[480px] max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--foreground)]">Add memory</h3>
              <button
                onClick={() => { setShowAddMemory(false); setAddText(''); setMemorySaveError(null) }}
                className="p-1 rounded text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Type or paste memory content..."
              autoFocus
              rows={5}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleAddMemory() }}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
            />
            <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
              Long memories stay as one saved item; the list shows short previews so you can scan them quickly.
            </p>
            {memorySaveError ? (
              <p className="mt-3 text-xs text-red-400" role="alert">{memorySaveError}</p>
            ) : null}
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setShowAddMemory(false); setAddText(''); setMemorySaveError(null) }}
                className={DIALOG_ACTION_BUTTON_CLASS}
              >Cancel</button>
              <button
                onClick={handleAddMemory}
                disabled={!addText.trim() || isSavingMemory}
                className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
              >{isSavingMemory ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import memory modal ── */}
      {showImportMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImportMemory(false)
              setImportText('')
              setImportMemoryError(null)
            }
          }}
        >
          <div className="w-[540px] max-w-[92vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-[var(--foreground)]">Import memory</h3>
              <button
                onClick={() => { setShowImportMemory(false); setImportText(''); setImportMemoryError(null) }}
                className="p-1 rounded text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-3 mb-5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[10px] font-semibold text-[var(--background)]">1</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--foreground)] mb-2">Copy this prompt into a chat with your other AI provider</p>
                <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 pt-3 pb-10">
                  <p className="text-xs leading-relaxed text-[var(--foreground)]">{IMPORT_MEMORY_PROMPT}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(IMPORT_MEMORY_PROMPT)
                      setImportPromptCopied(true)
                      setTimeout(() => setImportPromptCopied(false), 2000)
                    }}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
                  >
                    {importPromptCopied ? <Check size={11} /> : <Copy size={11} />}
                    {importPromptCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mb-5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[10px] font-semibold text-[var(--background)]">2</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--foreground)] mb-2">Paste results below to add to your memory</p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your memory details here"
                  rows={6}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
                />
              </div>
            </div>
            {importMemoryError ? (
              <p className="mb-3 text-xs text-red-400" role="alert">{importMemoryError}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowImportMemory(false); setImportText(''); setImportMemoryError(null) }}
                className={DIALOG_ACTION_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                onClick={handleImportMemory}
                disabled={!importText.trim() || isImporting}
                className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
              >{isImporting ? 'Saving…' : 'Add to memory'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New file/folder modal ── */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
          onClick={(e) => { if (e.target === e.currentTarget) { setDialog(null); setDialogName('') } }}
        >
          <div className="w-[400px] max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--foreground)]">
                New {dialog.type === 'folder' ? 'folder' : 'file'}
              </h3>
              <button onClick={() => { setDialog(null); setDialogName('') }} className="p-1 rounded text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            </div>
            <input
              value={dialogName}
              onChange={(e) => setDialogName(e.target.value)}
              placeholder={dialog.type === 'folder' ? 'Folder name' : 'filename.txt'}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile() }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setDialog(null); setDialogName('') }}
                className={DIALOG_ACTION_BUTTON_CLASS}
              >Cancel</button>
              <button
                onClick={handleCreateFile}
                disabled={!dialogName.trim() || isCreating}
                className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
              >{isCreating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileUploadRef} type="file" className="hidden" onChange={handleUploadFile} />
      <input
        ref={folderUploadRef}
        type="file"
        className="hidden"
        onChange={handleUploadFolder}
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
      />

      {/* ── View memory dialog ── */}
      {selectedMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeMemoryDialog() }}
        >
          <div
            className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--foreground)]">Memory</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-light)]">
                  {new Date(selectedMemory.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(selectedMemory.memoryId)}
                  className="rounded-md p-1.5 text-[var(--muted-light)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={closeMemoryDialog}
                  className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{selectedMemory.fullContent}</p>
              {selectedMemory.source ? (
                <p className="mt-4 text-xs text-[var(--muted-light)]">Source: {selectedMemory.source}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── View file preview (dialog or sidebar) ── */}
      {selectedFile && filePreviewMode === 'dialog' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeFileDialog() }}
        >
          <div
            className="flex h-[min(90vh,800px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <FileViewerPanel
              name={selectedFile.name}
              content={fileContent}
              url={selectedFile.downloadUrl || selectedFile.isStorageBacked ? `/api/app/files/${selectedFile._id}/content` : undefined}
              isSaving={isSavingFile}
              isEditable={isEditableType(selectedFile.name)}
              onContentChange={handleFileContentChange}
              headerRight={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFilePreviewMode('sidebar')}
                    title="Dock to sidebar"
                    className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  >
                    <PanelRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={closeFileDialog}
                    className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              }
            />
          </div>
        </div>
      )}
      {selectedFile && filePreviewMode === 'sidebar' && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-[40rem] max-w-full flex-col border-l border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl">
          <FileViewerPanel
            name={selectedFile.name}
            content={fileContent}
            url={selectedFile.downloadUrl || selectedFile.isStorageBacked ? `/api/app/files/${selectedFile._id}/content` : undefined}
            isSaving={isSavingFile}
            isEditable={isEditableType(selectedFile.name)}
            onContentChange={handleFileContentChange}
            headerRight={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilePreviewMode('dialog')}
                  title="Pop out to dialog"
                  className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={closeFileDialog}
                  className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <X size={14} />
                </button>
              </div>
            }
          />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <h1 className="text-sm font-medium text-[var(--foreground)]">
            {activeTab === 'memories' ? 'Memories' : activeTab === 'files' ? 'Files' : 'Outputs'}
          </h1>
          {activeTab !== 'outputs' && !memorySearchOpen && !fileSearchOpen && (
            <span className="text-xs text-[var(--muted-light)]">
              {activeTab === 'memories' ? memoriesFiltered.length : filesFiltered.length} items
            </span>
          )}
        </div>
        {activeTab === 'memories' && memorySearchOpen ? (
          <input
            value={memorySearchQuery}
            onChange={(e) => setMemorySearchQuery(e.target.value)}
            placeholder="Search memories…"
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
          />
        ) : activeTab === 'files' && fileSearchOpen ? (
          <input
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            placeholder="Search file names…"
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
          />
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-2">
          {(activeTab === 'memories' || activeTab === 'files' || activeTab === 'outputs') &&
            (selectMode ? (
              <>
                <button type="button" onClick={exitSelectMode} className={TOOLBAR_FILLED_BUTTON_CLASS}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    bulkDeleting ||
                    (activeTab === 'memories'
                      ? selectedMemoryIds.size === 0
                      : activeTab === 'files'
                        ? selectedFileIds.size === 0
                        : selectedOutputIds.size === 0)
                  }
                  onClick={() => {
                    if (activeTab === 'memories') void bulkDeleteMemories()
                    else if (activeTab === 'files') void bulkDeleteFiles()
                    else void bulkDeleteOutputs()
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  {bulkDeleting
                    ? 'Deleting…'
                    : `Delete (${
                        activeTab === 'memories'
                          ? selectedMemoryIds.size
                          : activeTab === 'files'
                            ? selectedFileIds.size
                            : selectedOutputIds.size
                      })`}
                </button>
              </>
            ) : (
              <button
                type="button"
                title="Select items"
                onClick={() => setSelectMode(true)}
                className={TOOLBAR_FILLED_BUTTON_CLASS}
              >
                <SquareMousePointer size={13} />
                Select
              </button>
            ))}
          {activeTab === 'outputs' && (
            <div ref={outputFilterRef} className="relative w-fit max-w-[13rem]">
              <button
                type="button"
                onClick={() => setOutputFilterOpen((o) => !o)}
                aria-expanded={outputFilterOpen}
                aria-haspopup="listbox"
                className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-left text-xs text-[var(--foreground)] md:py-1 ${
                  outputFilterOpen ? 'bg-[var(--border)]' : 'hover:bg-[var(--border)]'
                }`}
              >
                <span className="min-w-0 truncate">{OUTPUT_FILTER_LABELS[outputFilter]}</span>
                <ChevronDown size={11} className="shrink-0" />
              </button>
              {outputFilterOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg"
                  role="listbox"
                >
                  {(['all', 'image', 'video', 'files'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={outputFilter === id}
                      onClick={() => commitOutputFilter(id)}
                      className={`w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-muted)] ${
                        outputFilter === id ? 'font-medium text-[var(--foreground)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {OUTPUT_FILTER_LABELS[id]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {(activeTab === 'memories' || activeTab === 'files' || activeTab === 'outputs') && (
            <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              <button
                type="button"
                title="List"
                onClick={() => updateQuery({ layout: 'list' })}
                className={`rounded px-2 py-1 transition-colors ${
                  layout === 'list'
                    ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-light)] hover:text-[var(--foreground)]'
                }`}
              >
                <LayoutList size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title="Cards"
                onClick={() => updateQuery({ layout: 'cards' })}
                className={`rounded px-2 py-1 transition-colors ${
                  layout === 'cards'
                    ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-light)] hover:text-[var(--foreground)]'
                }`}
              >
                <LayoutGrid size={14} strokeWidth={1.75} />
              </button>
            </div>
          )}
          {activeTab === 'outputs' && (
            <button
              type="button"
              title="Refresh"
              onClick={() => setOutputsRefreshKey((k) => k + 1)}
              className={TOOLBAR_ICON_BUTTON_CLASS}
            >
              <RefreshCw size={14} strokeWidth={1.75} />
            </button>
          )}
          {activeTab === 'memories' ? (
            <>
              <button
                type="button"
                title="Search memories"
                onClick={() => setMemorySearchOpen((v) => !v)}
                className={`${TOOLBAR_ICON_BUTTON_CLASS} ${
                  memorySearchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
                }`}
              >
                <Search size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => { setShowImportMemory(true); setImportMemoryError(null) }}
                className={TOOLBAR_FILLED_BUTTON_CLASS}
              >
                <FolderInput size={13} />
                Import
              </button>
              <button
                type="button"
                onClick={() => { setShowAddMemory(true); setMemorySaveError(null) }}
                className={TOOLBAR_FILLED_BUTTON_CLASS}
              >
                <Plus size={13} />
                New Memory
              </button>
            </>
          ) : activeTab === 'files' ? (
            <>
              <button
                type="button"
                title="Search files"
                onClick={() => setFileSearchOpen((v) => !v)}
                className={`${TOOLBAR_ICON_BUTTON_CLASS} ${
                  fileSearchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
                }`}
              >
                <Search size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => fileUploadRef.current?.click()}
                className={TOOLBAR_FILLED_BUTTON_CLASS}
              >
                <FilePlus size={13} />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => folderUploadRef.current?.click()}
                className={TOOLBAR_FILLED_BUTTON_CLASS}
              >
                <FolderPlus size={13} />
                Upload Folder
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        className={`min-h-0 flex-1 px-6 py-4 ${
          activeTab === 'outputs' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {activeTab === 'outputs' && (
          <OutputsView
            key={outputsRefreshKey}
            embedded
            layout={layout}
            selectionMode={selectMode}
            selectedIds={selectedOutputIds}
            onToggleSelect={toggleOutputSelect}
          />
        )}

        {activeTab === 'memories' && (memorySavePendingPreview || importPendingPreview) && (
          <div
            className="mx-auto mb-4 flex max-w-3xl items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3"
            aria-busy
            aria-live="polite"
          >
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-[var(--muted)]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--foreground)]">
                {memorySavePendingPreview ? 'Saving memory…' : 'Importing memory…'}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
                {memorySavePendingPreview ?? importPendingPreview}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'memories' && memoriesLoading && <KnowledgeListSkeleton rows={10} />}
        {activeTab === 'memories' && !memoriesLoading && memories.length === 0 && !memorySavePendingPreview && !importPendingPreview && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--muted-light)]">
            <Brain size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories yet</p>
            <button
              type="button"
              onClick={() => { setShowAddMemory(true); setMemorySaveError(null) }}
              className="text-xs text-[var(--foreground)] underline underline-offset-2"
            >
              Add your first memory
            </button>
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memories.length > 0 && memoriesFiltered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--muted-light)]">
            <Search size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories match your search</p>
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memoriesFiltered.length > 0 && layout === 'list' && (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {memoriesFiltered.map((memory) => {
              const bulkSel = selectedMemoryIds.has(memory.memoryId)
              return (
                <div
                  key={memory.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => (selectMode ? toggleMemorySelect(memory.memoryId) : openMemory(memory))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (selectMode) toggleMemorySelect(memory.memoryId)
                      else openMemory(memory)
                    }
                  }}
                  className={`group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-muted)] ${
                    bulkSel ? 'border-[var(--border)] bg-[var(--surface-muted)]' : ''
                  }`}
                >
                  {selectMode ? (
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] ${
                        bulkSel ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
                      }`}
                      aria-hidden
                    >
                      {bulkSel ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
                    </span>
                  ) : null}
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--foreground)]">{memory.content}</p>
                  {!selectMode ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.memoryId) }}
                      className="shrink-0 rounded p-1 text-[var(--muted-light)] opacity-0 transition-opacity hover:bg-[var(--surface-subtle)] hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memoriesFiltered.length > 0 && layout === 'cards' && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3">
            {memoriesFiltered.map((memory) => {
              const bulkSel = selectedMemoryIds.has(memory.memoryId)
              return (
                <button
                  key={memory.key}
                  type="button"
                  onClick={() => (selectMode ? toggleMemorySelect(memory.memoryId) : openMemory(memory))}
                  className={`group relative mb-4 block w-full break-inside-avoid rounded-xl border bg-[var(--surface-elevated)] p-4 text-left transition-shadow hover:shadow-md ${
                    bulkSel ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
                  }`}
                  style={{ breakInside: 'avoid' }}
                >
                  {selectMode ? (
                    <span
                      className={`absolute left-3 top-3 z-10 flex h-4 w-4 items-center justify-center rounded border border-[var(--border)] ${
                        bulkSel ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
                      }`}
                      aria-hidden
                    >
                      {bulkSel ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
                    </span>
                  ) : null}
                  <p className={`line-clamp-6 text-xs leading-relaxed text-[var(--foreground)] ${selectMode ? 'pl-7' : ''}`}>
                    {memory.content}
                  </p>
                  <p className="mt-3 text-[10px] text-[var(--muted-light)]">
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {activeTab === 'files' && fileUploadPending && (
          <div
            className="mx-auto mb-4 flex max-w-3xl items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3"
            aria-busy
            aria-live="polite"
          >
            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-[var(--muted)]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--foreground)]">Uploading…</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{fileUploadPending.label}</p>
            </div>
          </div>
        )}
        {activeTab === 'files' && fileUploadError && (
          <p className="mx-auto mb-3 max-w-3xl text-xs text-red-400" role="alert">
            {fileUploadError}
          </p>
        )}

        {activeTab === 'files' && filesLoading && <FileTreeSkeleton rows={10} />}
        {activeTab === 'files' && !filesLoading && files.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--muted-light)]">
            <FileText size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No files yet</p>
          </div>
        )}
        {activeTab === 'files' && !filesLoading && files.length > 0 && rootNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--muted-light)]">
            <Search size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No files match your search</p>
          </div>
        )}
        {activeTab === 'files' && !filesLoading && rootNodes.length > 0 && layout === 'list' && (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {rootNodes.map((node) => (
              <FileTreeNode
                key={node._id}
                node={node}
                allNodes={filesFiltered}
                depth={0}
                selectedId={selectedFile?._id ?? null}
                onSelect={handleSelectFile}
                onDelete={handleDeleteNode}
                bulkSelectMode={selectMode}
                bulkSelectedIds={selectedFileIds}
                onToggleBulk={toggleFileBulkSelect}
              />
            ))}
          </div>
        )}
        {activeTab === 'files' && !filesLoading && flatFilesSorted.length > 0 && layout === 'cards' && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
            {flatFilesSorted.map((file) => {
              const bulkSel = selectedFileIds.has(file._id)
              return (
                <button
                  key={file._id}
                  type="button"
                  onClick={() => (selectMode ? toggleFileBulkSelect(file._id) : handleSelectFile(file))}
                  className={`group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-[var(--surface-elevated)] text-left transition-shadow hover:shadow-md ${
                    bulkSel ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
                  }`}
                  style={{ breakInside: 'avoid' }}
                >
                  {selectMode ? (
                    <span
                      className={`absolute left-3 top-3 z-10 flex h-4 w-4 items-center justify-center rounded border border-[var(--border)] ${
                        bulkSel ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]'
                      }`}
                      aria-hidden
                    >
                      {bulkSel ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
                    </span>
                  ) : null}
                  <div className="flex h-28 items-center justify-center bg-[var(--surface-muted)]">
                    <FileText size={36} className="text-[var(--muted-light)]" />
                  </div>
                  <div className="px-3 py-2">
                    <p className="line-clamp-2 text-xs font-medium text-[var(--foreground)]">{file.name}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] text-[var(--muted)]">{filePathLabel(filesFiltered, file)}</p>
                    <p className="mt-1 text-[10px] text-[var(--muted-light)]">
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
