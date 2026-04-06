'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Brain, Trash2, Plus, X, FilePlus, FolderPlus,
  ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Loader2, Search,
  LayoutList, LayoutGrid, RefreshCw,
} from 'lucide-react'
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
}: {
  node: FileNode
  allNodes: FileNode[]
  depth: number
  selectedId: string | null
  onSelect: (node: FileNode) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const [open, setOpen] = useState(true)
  const children = allNodes.filter((n) => n.parentId === node._id)
  const isSelected = node.type === 'file' && node._id === selectedId

  return (
    <div>
      <div
        onClick={() => node.type === 'folder' ? setOpen((v) => !v) : onSelect(node)}
        className={`group flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors ${
          isSelected ? 'bg-[#e8e8e8] text-[#0a0a0a]' : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
      >
        {node.type === 'folder' ? (
          <>
            <ChevronRight size={10} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            {open
              ? <FolderOpen size={12} className="shrink-0 text-[#888]" />
              : <Folder size={12} className="shrink-0 text-[#888]" />}
          </>
        ) : (
          <>
            <span className="w-[10px] shrink-0" />
            <FileText size={12} className="shrink-0 text-[#888]" />
          </>
        )}
        <span className="flex-1 truncate">{node.name}</span>
        <button
          onClick={(e) => onDelete(node._id, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
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

  // ── File system state ──
  const [files, setFiles] = useState<FileNode[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState('')
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

  const loadFile = useCallback(async (fileId: string) => {
    const res = await fetch(`/api/app/files?fileId=${fileId}`)
    if (!res.ok) return
    const file = (await res.json()) as FileNode
    setSelectedFile(file)
    setFileContent(file.content ?? '')
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
    try {
      const res = await fetch('/api/app/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, source: 'manual' }),
      })
      if (!res.ok) return
      setAddText('')
      setShowAddMemory(false)
      await loadMemories()
    } finally { setIsSavingMemory(false) }
  }

  async function handleDeleteMemory(memoryId: string) {
    await fetch(`/api/app/memory?memoryId=${memoryId}`, { method: 'DELETE' })
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
      if (res.ok) { setDialogName(''); setDialog(null); await loadFiles() }
    } finally { setIsCreating(false) }
  }

  function handleSelectFile(node: FileNode) {
    void loadFile(node._id)
    updateQuery({ view: 'files', file: node._id })
  }

  async function handleDeleteNode(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/files?fileId=${id}`, { method: 'DELETE' })
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

  async function uploadSingleFile(file: File, parentId: string | null) {
    const fileType = getFileType(file.name)
    const isText = fileType === 'text' || fileType === 'markdown' || fileType === 'csv'
    if (isText) {
      const content = await file.text()
      await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: 'file', parentId, content }),
      })
    } else {
      const urlRes = await fetch('/api/app/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizeBytes: file.size, name: file.name, mimeType: file.type || undefined }),
      })
      if (!urlRes.ok) return
      const { uploadUrl, r2Key } = await urlRes.json() as { uploadUrl: string; r2Key: string }
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadRes.ok) return
      await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: 'file', parentId, r2Key, sizeBytes: file.size }),
      })
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadSingleFile(file, null)
    await loadFiles()
    e.target.value = ''
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files
    if (!uploadedFiles) return
    const folders = new Map<string, string>()
    for (const file of Array.from(uploadedFiles)) {
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
          if (res.ok) { const { id } = await res.json(); folders.set(folderPath, id) }
        }
      }
      const parentFolderPath = parts.slice(0, -1).join('/')
      const parentId = folders.get(parentFolderPath) ?? null
      await uploadSingleFile(file, parentId)
    }
    await loadFiles()
    e.target.value = ''
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
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddMemory(false); setAddText('') } }}
        >
          <div className="bg-white rounded-xl p-6 w-[480px] max-w-[90vw] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#0a0a0a]">Add memory</h3>
              <button onClick={() => { setShowAddMemory(false); setAddText('') }} className="p-1 rounded hover:bg-[#f0f0f0] transition-colors">
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
              className="w-full text-sm text-[#0a0a0a] border border-[#e5e5e5] rounded-lg px-3 py-2.5 resize-none outline-none placeholder-[#aaa] focus:border-[#0a0a0a] transition-colors"
            />
            <p className="mt-2 text-[11px] text-[#888] leading-snug">
              Long memories stay as one saved item; the list shows short previews so you can scan them quickly.
            </p>
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setShowAddMemory(false); setAddText('') }}
                className="px-3 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#f0f0f0] transition-colors"
              >Cancel</button>
              <button
                onClick={handleAddMemory}
                disabled={!addText.trim() || isSavingMemory}
                className="px-3 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#222] transition-colors"
              >{isSavingMemory ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New file/folder modal ── */}
      {dialog && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) { setDialog(null); setDialogName('') } }}
        >
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#0a0a0a]">
                New {dialog.type === 'folder' ? 'folder' : 'file'}
              </h3>
              <button onClick={() => { setDialog(null); setDialogName('') }} className="p-1 rounded hover:bg-[#f0f0f0]">
                <X size={14} />
              </button>
            </div>
            <input
              value={dialogName}
              onChange={(e) => setDialogName(e.target.value)}
              placeholder={dialog.type === 'folder' ? 'Folder name' : 'filename.txt'}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFile() }}
              className="w-full text-sm border border-[#e5e5e5] rounded-lg px-3 py-2.5 outline-none placeholder-[#aaa] focus:border-[#0a0a0a] transition-colors"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setDialog(null); setDialogName('') }}
                className="px-3 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#f0f0f0] transition-colors"
              >Cancel</button>
              <button
                onClick={handleCreateFile}
                disabled={!dialogName.trim() || isCreating}
                className="px-3 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#222] transition-colors"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeMemoryDialog() }}
        >
          <div
            className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
              <span className="text-sm font-medium text-[#0a0a0a]">Memory</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#aaa]">
                  {new Date(selectedMemory.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(selectedMemory.memoryId)}
                  className="rounded-md p-1.5 text-[#aaa] transition-colors hover:bg-red-50 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={closeMemoryDialog}
                  className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#0a0a0a]">{selectedMemory.fullContent}</p>
              {selectedMemory.source ? (
                <p className="mt-4 text-xs text-[#aaa]">Source: {selectedMemory.source}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── View file dialog ── */}
      {selectedFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeFileDialog() }}
        >
          <div
            className="flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-end border-b border-[#e5e5e5] px-2 py-2">
              <button
                type="button"
                onClick={closeFileDialog}
                className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex min-h-[min(75vh,720px)] flex-1 flex-col overflow-hidden">
              <FileViewerPanel
                name={selectedFile.name}
                content={fileContent}
                isSaving={isSavingFile}
                isEditable={isEditableType(selectedFile.name)}
                onContentChange={handleFileContentChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#e5e5e5] px-6">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-sm font-medium text-[#0a0a0a]">
            {activeTab === 'memories' ? 'Memories' : activeTab === 'files' ? 'Files' : 'Outputs'}
          </h1>
          {activeTab !== 'outputs' && (
            <span className="text-xs text-[#aaa]">
              {activeTab === 'memories' ? memoriesFiltered.length : filesFiltered.length} items
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeTab === 'outputs' && (
            <div ref={outputFilterRef} className="relative w-fit max-w-[13rem]">
              <button
                type="button"
                onClick={() => setOutputFilterOpen((o) => !o)}
                aria-expanded={outputFilterOpen}
                aria-haspopup="listbox"
                className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[#f0f0f0] px-2.5 py-1.5 text-left text-xs md:py-1 ${
                  outputFilterOpen ? 'bg-[#e8e8e8]' : 'text-[#525252] hover:bg-[#e8e8e8]'
                }`}
              >
                <span className="min-w-0 truncate">{OUTPUT_FILTER_LABELS[outputFilter]}</span>
                <ChevronDown size={11} className="shrink-0" />
              </button>
              {outputFilterOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-lg"
                  role="listbox"
                >
                  {(['all', 'image', 'video', 'files'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={outputFilter === id}
                      onClick={() => commitOutputFilter(id)}
                      className={`w-full whitespace-nowrap px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#f5f5f5] ${
                        outputFilter === id ? 'font-medium text-[#0a0a0a]' : 'text-[#525252]'
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
            <div className="flex items-center rounded-md border border-[#e5e5e5] bg-[#fafafa] p-0.5">
              <button
                type="button"
                title="List"
                onClick={() => updateQuery({ layout: 'list' })}
                className={`rounded px-2 py-1 transition-colors ${
                  layout === 'list' ? 'bg-white text-[#0a0a0a] shadow-sm' : 'text-[#888] hover:text-[#525252]'
                }`}
              >
                <LayoutList size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title="Cards"
                onClick={() => updateQuery({ layout: 'cards' })}
                className={`rounded px-2 py-1 transition-colors ${
                  layout === 'cards' ? 'bg-white text-[#0a0a0a] shadow-sm' : 'text-[#888] hover:text-[#525252]'
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
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:bg-[#ebebeb]"
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
                className={`flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:bg-[#ebebeb] ${
                  memorySearchOpen ? 'border-[#0a0a0a] bg-[#ebebeb]' : ''
                }`}
              >
                <Search size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => setShowAddMemory(true)}
                className="flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#fafafa] transition-colors hover:bg-[#222]"
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
                className={`flex h-8 w-8 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-[#525252] transition-colors hover:bg-[#ebebeb] ${
                  fileSearchOpen ? 'border-[#0a0a0a] bg-[#ebebeb]' : ''
                }`}
              >
                <Search size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => fileUploadRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs text-[#fafafa] transition-colors hover:bg-[#222]"
              >
                <FilePlus size={13} />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => folderUploadRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-3 py-1.5 text-xs text-[#525252] transition-colors hover:bg-[#e8e8e8]"
              >
                <FolderPlus size={13} />
                Upload Folder
              </button>
            </>
          ) : null}
        </div>
      </div>

      {activeTab === 'memories' && memorySearchOpen && (
        <div className="shrink-0 border-b border-[#e5e5e5] px-6 py-2">
          <input
            value={memorySearchQuery}
            onChange={(e) => setMemorySearchQuery(e.target.value)}
            placeholder="Search memories…"
            autoFocus
            className="w-full max-w-sm rounded-md border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs text-[#0a0a0a] outline-none placeholder-[#aaa] focus:border-[#0a0a0a]"
          />
        </div>
      )}
      {activeTab === 'files' && fileSearchOpen && (
        <div className="shrink-0 border-b border-[#e5e5e5] px-6 py-2">
          <input
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            placeholder="Search file names…"
            autoFocus
            className="w-full max-w-sm rounded-md border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs text-[#0a0a0a] outline-none placeholder-[#aaa] focus:border-[#0a0a0a]"
          />
        </div>
      )}

      {/* ── Main content ── */}
      <div
        className={`min-h-0 flex-1 px-6 py-4 ${
          activeTab === 'outputs' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {activeTab === 'outputs' && (
          <OutputsView key={outputsRefreshKey} embedded layout={layout} />
        )}

        {activeTab === 'memories' && memoriesLoading && (
          <div className="flex justify-center pt-16 text-[#888]">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#aaa]">
            <Brain size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories yet</p>
            <button
              type="button"
              onClick={() => setShowAddMemory(true)}
              className="text-xs text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
            >
              Add your first memory
            </button>
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memories.length > 0 && memoriesFiltered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#aaa]">
            <Search size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No memories match your search</p>
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memoriesFiltered.length > 0 && layout === 'list' && (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {memoriesFiltered.map((memory) => (
              <div
                key={memory.key}
                role="button"
                tabIndex={0}
                onClick={() => openMemory(memory)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMemory(memory) } }}
                className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[#e5e5e5] hover:bg-[#fafafa]"
              >
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-[#525252]">{memory.content}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.memoryId) }}
                  className="shrink-0 rounded p-1 text-[#aaa] opacity-0 transition-opacity hover:bg-[#f0f0f0] hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'memories' && !memoriesLoading && memoriesFiltered.length > 0 && layout === 'cards' && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3">
            {memoriesFiltered.map((memory) => (
              <button
                key={memory.key}
                type="button"
                onClick={() => openMemory(memory)}
                className="group mb-4 block w-full break-inside-avoid rounded-xl border border-[#e5e5e5] bg-white p-4 text-left transition-shadow hover:shadow-md"
                style={{ breakInside: 'avoid' }}
              >
                <p className="line-clamp-6 text-xs leading-relaxed text-[#525252]">{memory.fullContent}</p>
                <p className="mt-3 text-[10px] text-[#aaa]">
                  {new Date(memory.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'files' && filesLoading && (
          <div className="flex justify-center pt-16 text-[#888]">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {activeTab === 'files' && !filesLoading && files.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#aaa]">
            <FileText size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No files yet</p>
          </div>
        )}
        {activeTab === 'files' && !filesLoading && files.length > 0 && rootNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#aaa]">
            <Search size={32} strokeWidth={1} className="opacity-40" />
            <p className="text-sm">No files match your search</p>
          </div>
        )}
        {activeTab === 'files' && !filesLoading && rootNodes.length > 0 && layout === 'list' && (
          <div className="mx-auto max-w-3xl rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-2 py-2">
            {rootNodes.map((node) => (
              <FileTreeNode
                key={node._id}
                node={node}
                allNodes={filesFiltered}
                depth={0}
                selectedId={selectedFile?._id ?? null}
                onSelect={handleSelectFile}
                onDelete={handleDeleteNode}
              />
            ))}
          </div>
        )}
        {activeTab === 'files' && !filesLoading && flatFilesSorted.length > 0 && layout === 'cards' && (
          <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
            {flatFilesSorted.map((file) => (
              <button
                key={file._id}
                type="button"
                onClick={() => handleSelectFile(file)}
                className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[#e5e5e5] bg-white text-left transition-shadow hover:shadow-md"
                style={{ breakInside: 'avoid' }}
              >
                <div className="flex h-28 items-center justify-center bg-[#f5f5f5]">
                  <FileText size={36} className="text-[#c0c0c0]" />
                </div>
                <div className="px-3 py-2">
                  <p className="line-clamp-2 text-xs font-medium text-[#0a0a0a]">{file.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-[#888]">{filePathLabel(filesFiltered, file)}</p>
                  <p className="mt-1 text-[10px] text-[#aaa]">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
