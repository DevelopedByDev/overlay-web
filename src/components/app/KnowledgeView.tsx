'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Brain, Trash2, Plus, X, FilePlus, FolderPlus,
  ChevronRight, FileText, Folder, FolderOpen, Loader2,
} from 'lucide-react'
import { FileViewerPanel, getFileType, isEditableType } from './FileViewer'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Virtual row: one Convex memory may appear as several sidebar entries. */
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
  content: string
  createdAt: number
  updatedAt: number
}

type Tab = 'memories' | 'filesystem'

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
  const searchParams = useSearchParams()
  const fileOpenParam = searchParams.get('file')
  const memoryOpenParam = searchParams.get('memory')

  const [activeTab, setActiveTab] = useState<Tab>('memories')

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

  // ── Load memories ──
  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/app/memory')
      if (res.ok) setMemories((await res.json()) as MemoryListItem[])
    } catch { /* ignore */ } finally { setMemoriesLoading(false) }
  }, [])

  // ── Load files ──
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/app/files')
      if (res.ok) setFiles(await res.json())
    } catch { /* ignore */ } finally { setFilesLoading(false) }
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])
  useEffect(() => { loadFiles() }, [loadFiles])

  useEffect(() => {
    if (!fileOpenParam || filesLoading || files.length === 0) return
    const node = files.find((f) => f._id === fileOpenParam && f.type === 'file')
    if (!node) return
    setActiveTab('filesystem')
    setSelectedFile(node)
    setFileContent(node.content)
  }, [fileOpenParam, files, filesLoading])

  useEffect(() => {
    if (!memoryOpenParam || memoriesLoading || memories.length === 0) return
    const mem = memories.find((m) => m.memoryId === memoryOpenParam)
    if (!mem) return
    setActiveTab('memories')
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
    if (selectedMemory?.memoryId === memoryId) setSelectedMemory(null)
    setMemories((prev) => prev.filter((m) => m.memoryId !== memoryId))
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
    setSelectedFile(node)
    setFileContent(node.content)
  }

  async function handleDeleteNode(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/app/files?fileId=${id}`, { method: 'DELETE' })
    if (selectedFile?._id === id) { setSelectedFile(null); setFileContent('') }
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
      setFiles((prev) => prev.map((f) => f._id === selectedFile._id ? { ...f, content: val } : f))
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
      // Binary file: upload directly to Convex storage
      const urlRes = await fetch('/api/app/files/upload-url', { method: 'POST' })
      if (!urlRes.ok) return
      const { uploadUrl } = await urlRes.json()
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadRes.ok) return
      const { storageId } = await uploadRes.json()
      await fetch('/api/app/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: 'file', parentId, storageId }),
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
    const files = e.target.files
    if (!files) return
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

  const rootNodes = files.filter((f) => f.parentId === null)

  return (
    <div className="flex h-full flex-col min-h-0">
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
              Long memories stay as one saved item; the sidebar shows short previews so you can scan them quickly.
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

      <div className="flex flex-1 min-h-0 w-full">
      {/* ── Secondary sidebar ── */}
      <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
        {/* Action buttons */}
        <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3 gap-2 shrink-0">
          {activeTab === 'memories' ? (
            <button
              onClick={() => setShowAddMemory(true)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
            >
              <Plus size={13} />
              New Memory
            </button>
          ) : (
            <div className="flex gap-1.5 w-full">
              <input ref={fileUploadRef} type="file" className="hidden" onChange={handleUploadFile} />
              <input
                ref={folderUploadRef}
                type="file"
                className="hidden"
                onChange={handleUploadFolder}
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
              />
              <button
                onClick={() => fileUploadRef.current?.click()}
                className="flex items-center gap-1 flex-1 px-2 py-1.5 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors justify-center"
              >
                <FilePlus size={12} />
                File
              </button>
              <button
                onClick={() => folderUploadRef.current?.click()}
                className="flex items-center gap-1 flex-1 px-2 py-1.5 rounded-md text-xs bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8] transition-colors justify-center"
              >
                <FolderPlus size={12} />
                Folder
              </button>
            </div>
          )}
        </div>

        {/* Tab toggle */}
        <div className="flex gap-0.5 p-2 border-b border-[#e5e5e5] shrink-0">
          {(['memories', 'filesystem'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 rounded text-xs transition-colors ${
                activeTab === tab
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'text-[#525252] hover:bg-[#e8e8e8]'
              }`}
            >
              {tab === 'memories' ? 'Memories' : 'Files'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
          {activeTab === 'memories' ? (
            memoriesLoading ? (
              <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
            ) : memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-[#aaa] px-4 text-center py-8">
                <Brain size={28} strokeWidth={1} className="opacity-40" />
                <p className="text-xs">No memories yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {memories.map((memory) => (
                  <div
                    key={memory.key}
                    onClick={() => setSelectedMemory(memory)}
                    className={`group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
                      selectedMemory?.key === memory.key
                        ? 'bg-[#e8e8e8] text-[#0a0a0a]'
                        : 'text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
                    }`}
                  >
                    <p className="flex-1 text-xs leading-relaxed line-clamp-2 min-w-0">{memory.content}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMemory(memory.memoryId) }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity mt-0.5"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            filesLoading ? (
              <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-[#aaa] px-4 text-center py-8">
                <FileText size={28} strokeWidth={1} className="opacity-40" />
                <p className="text-xs">No files yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {rootNodes.map((node) => (
                  <FileTreeNode
                    key={node._id}
                    node={node}
                    allNodes={files}
                    depth={0}
                    selectedId={selectedFile?._id ?? null}
                    onSelect={handleSelectFile}
                    onDelete={handleDeleteNode}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'memories' ? (
          selectedMemory ? (
            <>
              <div className="flex h-16 items-center justify-between border-b border-[#e5e5e5] px-6 shrink-0">
                <span className="text-sm font-medium text-[#0a0a0a]">Memory</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#aaa]">
                    {new Date(selectedMemory.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => handleDeleteMemory(selectedMemory.memoryId)}
                    className="p-1.5 rounded-md text-[#aaa] hover:bg-red-50 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-8">
                <p className="text-sm text-[#0a0a0a] leading-relaxed whitespace-pre-wrap max-w-2xl">{selectedMemory.fullContent}</p>
                {selectedMemory.source && (
                  <p className="text-xs text-[#aaa] mt-4">Source: {selectedMemory.source}</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
              <Brain size={40} strokeWidth={1} className="opacity-30" />
              <p className="text-sm">Select a memory to view</p>
              <button
                onClick={() => setShowAddMemory(true)}
                className="text-xs text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a] transition-colors"
              >
                Add your first memory
              </button>
            </div>
          )
        ) : (
          selectedFile ? (
            <FileViewerPanel
              name={selectedFile.name}
              content={fileContent}
              isSaving={isSavingFile}
              isEditable={isEditableType(selectedFile.name)}
              onContentChange={handleFileContentChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
              <FileText size={40} strokeWidth={1} className="opacity-30" />
              <p className="text-sm">Select a file to view</p>
            </div>
          )
        )}
      </div>
      </div>
    </div>
  )
}
