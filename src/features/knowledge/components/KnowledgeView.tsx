'use client'

// Compatibility wrapper: canonical knowledge contracts/controllers live in @overlay/app-core,
// typed transport lives in @overlay/api-client, and reusable presentation lives in @overlay/modules-react.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen, Trash2, Plus, FilePlus, FolderPlus, FolderInput,
  ChevronRight, ChevronDown, FolderOpen, Search,
  LayoutList, LayoutGrid, RefreshCw, SquareMousePointer,
  ArrowLeft, Upload,
} from 'lucide-react'
import posthog from 'posthog-js'
import { FileViewer, getFileType, isEditableType } from '@/features/files/components/FileViewer'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import {
  FILES_CHANGED_EVENT,
  IMPORT_MEMORY_PROMPT,
  OUTPUT_FILTER_LABELS,
  canMoveKnowledgeFile,
  createManualMemoryRequest,
  filterKnowledgeFileNodes,
  filterMemoryRows,
  folderBreadcrumb as buildFolderBreadcrumb,
  knowledgePendingPreview,
  opensInDocumentEditor,
  resolveKnowledgeLayout,
  resolveKnowledgeOutputFilter,
  resolveKnowledgeTab,
  sortedCurrentFolderFiles,
  sortedCurrentFolderFolders,
  sortedCurrentFolderNodes,
  type KnowledgeFileNode as FileNode,
  type KnowledgeOutputFilter as OutputFilter,
  type KnowledgeTab as Tab,
  type MemoryRow as MemoryListItem,
} from '@overlay/app-core'
import {
  AddMemoryDialog,
  CreateKnowledgeItemDialog,
  HiddenKnowledgeFileInputs,
  ImportMemoryDialog,
  KnowledgeFilesPanel,
  KnowledgeMemoriesPanel,
  KnowledgePendingNotice,
  MemoryDetailDialog,
} from '@overlay/modules-react/knowledge'

// ─── Types ────────────────────────────────────────────────────────────────────

const TOOLBAR_ICON_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

const TOOLBAR_FILLED_BUTTON_CLASS =
  'flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]'

// ─── Main KnowledgeView ───────────────────────────────────────────────────────

export default function KnowledgeView({
  userId: _userId,
  mode = 'knowledge',
  initialFiles,
  initialMemories,
}: {
  userId: string
  mode?: 'knowledge' | 'files'
  initialFiles?: FileNode[]
  initialMemories?: MemoryListItem[]
}) {
  void _userId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fileOpenParam = searchParams?.get('file') ?? null
  const memoryOpenParam = searchParams?.get('memory') ?? null
  const folderParam = searchParams?.get('folder') ?? null
  const viewParam = searchParams?.get('view') ?? (mode === 'files' ? 'files' : 'memories')
  const activeTab: Tab = resolveKnowledgeTab({ mode, view: viewParam })

  const layout = resolveKnowledgeLayout({ layout: searchParams?.get('layout'), activeTab })

  function updateQuery(updates: Record<string, string | null | undefined>) {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === '') p.delete(k)
      else p.set(k, v)
    }
    router.push(`${pathname}?${p.toString()}`)
  }

  const [, setOutputsRefreshKey] = useState(0)
  const [outputFilterOpen, setOutputFilterOpen] = useState(false)
  const outputFilterRef = useRef<HTMLDivElement>(null)

  const outputFilter = resolveKnowledgeOutputFilter(searchParams?.get('out'))

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
  const [memories, setMemories] = useState<MemoryListItem[]>(() => initialMemories ?? [])
  const [memoriesLoading, setMemoriesLoading] = useState(initialMemories === undefined)
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
  const [files, setFiles] = useState<FileNode[]>(() => initialFiles ?? [])
  const [filesLoading, setFilesLoading] = useState(initialFiles === undefined)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [fileTitle, setFileTitle] = useState('')
  const [isSavingFile, setIsSavingFile] = useState(false)
  const [dialog, setDialog] = useState<{ type: 'file' | 'folder'; parentId: string | null } | null>(null)
  const [dialogName, setDialogName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileUploadRef = useRef<HTMLInputElement>(null)
  const folderUploadRef = useRef<HTMLInputElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const uploadMenuRef = useRef<HTMLDivElement>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)

  const [memorySearchOpen, setMemorySearchOpen] = useState(false)
  const [memorySearchQuery, setMemorySearchQuery] = useState('')
  const [fileSearchQuery] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(() => new Set())
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(() => new Set())
  const [selectedOutputIds, setSelectedOutputIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    if (!createMenuOpen && !uploadMenuOpen) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (createMenuOpen && createMenuRef.current && !createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false)
      }
      if (uploadMenuOpen && uploadMenuRef.current && !uploadMenuRef.current.contains(target)) {
        setUploadMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [createMenuOpen, uploadMenuOpen])

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

  async function bulkDeleteMemories() {
    if (selectedMemoryIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        [...selectedMemoryIds].map((id) =>
          overlayAppClient.memory.deleteResponse({ memoryId: id }),
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
          overlayAppClient.files.deleteResponse({ fileId: id }),
        ),
      )
      if (selectedFile && selectedFileIds.has(selectedFile._id)) {
        setSelectedFile(null)
        setFileContent('')
        setFileTitle('')
        updateQuery({ file: null })
      }
      await loadFiles()
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
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
          overlayAppClient.files.deleteResponse({ fileId: id }),
        ),
      )
      setOutputsRefreshKey((k) => k + 1)
      exitSelectMode()
    } finally {
      setBulkDeleting(false)
    }
  }

  const loadFile = useCallback(async (fileId: string) => {
    const res = await overlayAppClient.files.getResponse({ fileId })
    if (!res.ok) return
    const file = (await res.json()) as FileNode
    if (opensInDocumentEditor(file)) {
      router.replace(`/app/notes?id=${encodeURIComponent(file._id)}`)
      return
    }
    setSelectedFile(file)
    setFileTitle(file.name)
    setFileContent(file.textContent ?? file.content ?? '')
  }, [router])

  const loadMemories = useCallback(async () => {
    try {
      setMemories(await overlayAppClient.memory.get<MemoryListItem[]>())
    } catch { /* ignore */ } finally { setMemoriesLoading(false) }
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await overlayAppClient.files.get<FileNode[]>())
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
    const preview = knowledgePendingPreview(text)
    setMemorySavePendingPreview(preview)
    try {
      const res = await overlayAppClient.memory.createResponse(createManualMemoryRequest(text))
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
    const preview = knowledgePendingPreview(text)
    setImportPendingPreview(preview)
    try {
      const res = await overlayAppClient.memory.createResponse(createManualMemoryRequest(text))
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
    const res = await overlayAppClient.memory.deleteResponse({ memoryId })
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
    setFileTitle('')
    updateQuery({ file: null })
  }

  // ── File handlers ──
  async function handleCreateFile() {
    const name = dialogName.trim()
    if (!name || isCreating || !dialog) return
    setIsCreating(true)
    try {
      const res = await overlayAppClient.files.createResponse({
        name,
        type: dialog.type,
        kind: dialog.type === 'folder' ? 'folder' : 'upload',
        parentId: dialog.parentId,
      })
      if (res.ok) {
        posthog.capture('knowledge_file_created', { file_name: name, type: dialog.type })
        if (dialog.type === 'folder') {
          posthog.capture('knowledge_folder_created', { folder_name: name })
        }
        setDialogName(''); setDialog(null); await loadFiles()
        window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
      }
    } finally { setIsCreating(false) }
  }

  async function handleCreateNoteFile() {
    const res = await overlayAppClient.files.createResponse({
      kind: 'note',
      name: 'Untitled',
      textContent: '',
      parentId: activeFolder?._id ?? null,
    })
    if (!res.ok) return
    const data = await res.json() as { id?: string; file?: unknown }
    if (!data.id) return
    window.dispatchEvent(new CustomEvent('overlay:notes-changed', { detail: { file: data.file } }))
    window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
    router.push(`/app/notes?id=${encodeURIComponent(data.id)}`)
  }

  function handleSelectFile(node: FileNode) {
    if (opensInDocumentEditor(node)) {
      router.push(`/app/notes?id=${encodeURIComponent(node._id)}`)
      return
    }
    void loadFile(node._id)
    updateQuery({ view: 'files', file: node._id })
  }

  async function handleDeleteNode(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const node = files.find((f) => f._id === id)
    const res = await overlayAppClient.files.deleteResponse({ fileId: id })
    if (res.ok && node) {
      posthog.capture('knowledge_file_deleted', { file_name: node.name, type: node.type })
    }
    if (selectedFile?._id === id) {
      setSelectedFile(null)
      setFileContent('')
      setFileTitle('')
      updateQuery({ file: null })
    }
    await loadFiles()
    window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
  }

  function handleFileContentChange(val: string) {
    setFileContent(val)
    if (!selectedFile) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setIsSavingFile(true)
      await overlayAppClient.files.updateResponse({ fileId: selectedFile._id, textContent: val })
      setFiles((prev) => prev.map((f) => f._id === selectedFile._id ? { ...f } : f))
      setIsSavingFile(false)
    }, 800)
  }

  function handleFileTitleChange(val: string) {
    setFileTitle(val)
    if (!selectedFile) return
    const nextName = val.trim() || 'Untitled'
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current)
    titleSaveTimerRef.current = setTimeout(async () => {
      setIsSavingFile(true)
      const res = await overlayAppClient.files.updateResponse({ fileId: selectedFile._id, name: nextName })
      if (res.ok) {
        setSelectedFile((prev) => prev ? { ...prev, name: nextName } : prev)
        setFiles((prev) => prev.map((f) => f._id === selectedFile._id ? { ...f, name: nextName } : f))
        window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
      }
      setIsSavingFile(false)
    }, 600)
  }

  async function readUploadError(res: Response, fallback: string): Promise<string> {
    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
    return data?.message || data?.error || fallback
  }

  async function uploadSingleFile(file: File, parentId: string | null): Promise<{ ok: boolean; error?: string }> {
    try {
      const fileType = getFileType(file.name)
      const isText = fileType === 'text' || fileType === 'markdown' || fileType === 'csv'
      if (isText) {
        const content = await file.text()
        const res = await overlayAppClient.files.createResponse({ name: file.name, type: 'file', parentId, content })
        if (!res.ok) return { ok: false, error: await readUploadError(res, 'Failed to save file') }
        return { ok: true }
      }
      const urlRes = await overlayAppClient.files.uploadUrlResponse({
        sizeBytes: file.size,
        name: file.name,
        mimeType: file.type || undefined,
      })
      if (!urlRes.ok) return { ok: false, error: await readUploadError(urlRes, 'Could not prepare upload') }
      const { uploadUrl, r2Key } = await urlRes.json() as { uploadUrl: string; r2Key: string }
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!uploadRes.ok) return { ok: false, error: 'Storage upload failed. Check your connection and try again.' }
      const createRes = await overlayAppClient.files.createResponse({ name: file.name, type: 'file', parentId, r2Key, sizeBytes: file.size })
      if (!createRes.ok) return { ok: false, error: await readUploadError(createRes, 'Failed to save file') }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' }
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileUploadError(null)
    setFileUploadPending({ label: file.name })
    try {
      const result = await uploadSingleFile(file, activeFolder?._id ?? null)
      if (!result.ok) {
        setFileUploadError(result.error ?? 'Upload failed. Check the file and try again.')
        return
      }
      await loadFiles()
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
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
            const res = await overlayAppClient.files.createResponse({ name: parts[i] ?? 'Folder', type: 'folder', parentId })
            if (res.ok) {
              const { id } = await res.json() as { id: string }
              folders.set(folderPath, id)
            }
          }
        }
        const parentFolderPath = parts.slice(0, -1).join('/')
        const parentId = folders.get(parentFolderPath) ?? null
        const result = await uploadSingleFile(file, parentId)
        if (!result.ok) {
          setFileUploadError(result.error ?? 'One or more files failed to upload.')
          break
        }
      }
      await loadFiles()
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
    } finally {
      setFileUploadPending(null)
      e.target.value = ''
    }
  }

  const activeFolder = useMemo(
    () => folderParam ? (files.find((f) => f._id === folderParam && f.type === 'folder') ?? null) : null,
    [files, folderParam],
  )
  const folderBreadcrumb = useMemo(() => buildFolderBreadcrumb(files, activeFolder), [activeFolder, files])

  async function moveFileToParent(fileId: string, parentId: string | null) {
    if (!canMoveKnowledgeFile(files, fileId, parentId)) return
    const res = await overlayAppClient.files.updateResponse({ fileId, parentId })
    if (res.ok) {
      await loadFiles()
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
    }
  }

  function navigateToFolder(folderId: string | null) {
    updateQuery({ folder: folderId, file: null })
  }

  const filesFiltered = useMemo(() => {
    return filterKnowledgeFileNodes(files, fileSearchQuery)
  }, [files, fileSearchQuery])

  const memoriesFiltered = useMemo(() => {
    return filterMemoryRows(memories, memorySearchQuery)
  }, [memories, memorySearchQuery])

  const currentParentId = activeFolder?._id ?? null
  const rootNodes = sortedCurrentFolderNodes(filesFiltered, currentParentId)
  const flatFilesSorted = sortedCurrentFolderFiles(filesFiltered, currentParentId)
  const folderCardsSorted = sortedCurrentFolderFolders(filesFiltered, currentParentId)

  return (
    <div className="flex flex-col h-full">
      {showAddMemory && (
        <AddMemoryDialog
          value={addText}
          saving={isSavingMemory}
          error={memorySaveError}
          onChange={setAddText}
          onSave={handleAddMemory}
          onClose={() => {
            setShowAddMemory(false)
            setAddText('')
            setMemorySaveError(null)
          }}
        />
      )}

      {showImportMemory && (
        <ImportMemoryDialog
          value={importText}
          saving={isImporting}
          error={importMemoryError}
          promptCopied={importPromptCopied}
          onChange={setImportText}
          onSave={handleImportMemory}
          onCopyPrompt={async () => {
            await navigator.clipboard.writeText(IMPORT_MEMORY_PROMPT)
            setImportPromptCopied(true)
            setTimeout(() => setImportPromptCopied(false), 2000)
          }}
          onClose={() => {
            setShowImportMemory(false)
            setImportText('')
            setImportMemoryError(null)
          }}
        />
      )}

      {dialog && (
        <CreateKnowledgeItemDialog
          type={dialog.type}
          value={dialogName}
          creating={isCreating}
          onChange={setDialogName}
          onCreate={handleCreateFile}
          onClose={() => {
            setDialog(null)
            setDialogName('')
          }}
        />
      )}

      <HiddenKnowledgeFileInputs
        fileUploadRef={fileUploadRef}
        folderUploadRef={folderUploadRef}
        onFileChange={handleUploadFile}
        onFolderChange={handleUploadFolder}
      />

      {selectedMemory && (
        <MemoryDetailDialog
          memory={selectedMemory}
          onClose={closeMemoryDialog}
          onDelete={handleDeleteMemory}
        />
      )}

      {/* ── Header ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        {selectedFile ? (
          <>
            <button
              type="button"
              onClick={closeFileDialog}
              title="Back to files"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft size={17} />
            </button>
            <input
              type="text"
              value={fileTitle}
              onChange={(e) => handleFileTitleChange(e.target.value)}
              placeholder="File title..."
              className="min-w-0 flex-1 bg-transparent font-medium text-xl text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              style={{ fontFamily: 'var(--font-serif)' }}
            />
            {isSavingFile ? (
              <span className="shrink-0 text-[11px] text-[var(--muted-light)]">Saving...</span>
            ) : null}
          </>
        ) : (
          <>
            {activeTab === 'files' && activeFolder ? (
              <div className="flex min-w-0 shrink flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToFolder(activeFolder.parentId)}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes('application/x-overlay-file-id')) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const fileId = e.dataTransfer.getData('application/x-overlay-file-id')
                    if (!fileId || fileId === activeFolder._id) return
                    void moveFileToParent(fileId, activeFolder.parentId)
                  }}
                  title={activeFolder.parentId ? 'Back to parent folder' : 'Back to all files'}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  <ArrowLeft size={17} />
                </button>
                <FolderOpen size={18} className="shrink-0 text-[var(--muted-light)]" />
                <div className="flex min-w-0 items-center gap-1 truncate text-sm">
                  <button
                    type="button"
                    onClick={() => navigateToFolder(null)}
                    className="shrink-0 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    Files
                  </button>
                  {folderBreadcrumb.map((node, i) => (
                    <span key={node._id} className="flex min-w-0 items-center gap-1">
                      <ChevronRight size={12} className="shrink-0 text-[var(--muted-light)]" />
                      {i === folderBreadcrumb.length - 1 ? (
                        <span className="truncate font-medium text-[var(--foreground)]">{node.name}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigateToFolder(node._id)}
                          className="truncate text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                        >
                          {node.name}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {!memorySearchOpen && (
                  <span className="shrink-0 text-xs text-[var(--muted-light)]">{rootNodes.length} items</span>
                )}
              </div>
            ) : (
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <h1 className="text-sm font-medium text-[var(--foreground)]">
                  {mode === 'files' ? 'Files' : activeTab === 'memories' ? 'Memories' : activeTab === 'files' ? 'Files' : 'Outputs'}
                </h1>
                {activeTab !== 'outputs' && !memorySearchOpen && (
                  <span className="text-xs text-[var(--muted-light)]">
                    {activeTab === 'memories' ? memoriesFiltered.length : filesFiltered.length} items
                  </span>
                )}
              </div>
            )}
            {activeTab === 'memories' && memorySearchOpen ? (
          <input
            value={memorySearchQuery}
            onChange={(e) => setMemorySearchQuery(e.target.value)}
            placeholder="Search memories…"
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
                className={TOOLBAR_ICON_BUTTON_CLASS}
              >
                <SquareMousePointer size={14} />
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
              {mode === 'files' ? (
                <div ref={createMenuRef} className="relative">
                  <button
                    type="button"
                    title="Create"
                    onClick={() => {
                      setCreateMenuOpen((v) => !v)
                      setUploadMenuOpen(false)
                    }}
                    className={TOOLBAR_ICON_BUTTON_CLASS}
                    aria-expanded={createMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Plus size={15} />
                  </button>
                  {createMenuOpen ? (
                    <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setCreateMenuOpen(false)
                          void handleCreateNoteFile()
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      >
                        <BookOpen size={13} />
                        New File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateMenuOpen(false)
                          setDialog({ type: 'folder', parentId: activeFolder?._id ?? null })
                          setDialogName('')
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      >
                        <FolderPlus size={13} />
                        New Folder
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div ref={uploadMenuRef} className="relative">
                <button
                  type="button"
                  title="Upload"
                  onClick={() => {
                    setUploadMenuOpen((v) => !v)
                    setCreateMenuOpen(false)
                  }}
                  className={TOOLBAR_ICON_BUTTON_CLASS}
                  aria-expanded={uploadMenuOpen}
                  aria-haspopup="menu"
                >
                  <Upload size={15} />
                </button>
                {uploadMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMenuOpen(false)
                        fileUploadRef.current?.click()
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    >
                      <FilePlus size={13} />
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMenuOpen(false)
                        folderUploadRef.current?.click()
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    >
                      <FolderInput size={13} />
                      Upload Folder
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
            </div>
          </>
        )}
      </div>

      {/* ── Main content ── */}
      <div
        className={`min-h-0 flex-1 px-6 py-4 ${
          activeTab === 'outputs' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {activeTab === 'files' && selectedFile && (
          <div className={`mx-auto flex min-h-full w-full flex-col ${isEditableType(selectedFile.name) ? 'max-w-5xl' : ''}`}>
            {isEditableType(selectedFile.name) ? (
              <>
                <textarea
                  value={fileContent}
                  onChange={(e) => handleFileContentChange(e.target.value)}
                  placeholder="Start typing..."
                  className="min-h-[calc(100vh-11rem)] w-full flex-1 resize-none bg-transparent px-2 py-4 font-mono text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)]"
                />
                <div className="shrink-0 border-t border-[var(--border)] px-2 py-2 text-[11px] text-[var(--muted-light)]">
                  Reference in chat with{' '}
                  <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5 font-mono text-[var(--foreground)]">
                    @{selectedFile.name}
                  </code>
                </div>
              </>
            ) : (
  <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden">
                <FileViewer
                  name={selectedFile.name}
                  content={fileContent}
                  url={selectedFile.downloadUrl || selectedFile.isStorageBacked ? `/api/v1/files/${selectedFile._id}/content` : undefined}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'memories' && (memorySavePendingPreview || importPendingPreview) && (
          <KnowledgePendingNotice
            title={memorySavePendingPreview ? 'Saving memory…' : 'Importing memory…'}
            preview={memorySavePendingPreview ?? importPendingPreview}
          />
        )}

        {activeTab === 'memories' && (
          <KnowledgeMemoriesPanel
            loading={memoriesLoading}
            memoriesCount={memories.length}
            memories={memoriesFiltered}
            layout={layout}
            selectedIds={selectedMemoryIds}
            selectMode={selectMode}
            hasPending={Boolean(memorySavePendingPreview || importPendingPreview)}
            onOpen={openMemory}
            onToggleSelect={toggleMemorySelect}
            onAddFirst={() => { setShowAddMemory(true); setMemorySaveError(null) }}
            onDelete={(memoryId, event) => {
              event.stopPropagation()
              void handleDeleteMemory(memoryId)
            }}
          />
        )}

        {activeTab === 'files' && !selectedFile && fileUploadPending && (
          <KnowledgePendingNotice title="Uploading…" preview={fileUploadPending.label} />
        )}
        {activeTab === 'files' && !selectedFile && fileUploadError && (
          <p className="mx-auto mb-3 max-w-3xl text-xs text-red-400" role="alert">
            {fileUploadError}
          </p>
        )}

        {activeTab === 'files' && !selectedFile && (
          <KnowledgeFilesPanel
            loading={filesLoading}
            filesCount={files.length}
            nodes={rootNodes}
            folders={folderCardsSorted}
            flatFiles={flatFilesSorted}
            allFiles={filesFiltered}
            layout={layout}
            selectedFileId={null}
            selectedIds={selectedFileIds}
            selectMode={selectMode}
            onSelect={handleSelectFile}
            onFolderOpen={navigateToFolder}
            onDelete={handleDeleteNode}
            onToggleBulk={toggleFileBulkSelect}
            onMove={moveFileToParent}
          />
        )}
      </div>
    </div>
  )
}
