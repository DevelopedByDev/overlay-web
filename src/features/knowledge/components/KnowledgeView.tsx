'use client'

// Compatibility wrapper: canonical knowledge contracts/controllers live in @overlay/app-core,
// typed transport lives in @overlay/api-client, and reusable presentation lives in @overlay/modules-react.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { FileViewer, getFileType, isEditableType } from '@/features/files/components/FileViewer'
import { KnowledgeViewHeader } from '@/features/knowledge/components/KnowledgeViewHeader'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import {
  FILES_CHANGED_EVENT,
  IMPORT_MEMORY_PROMPT,
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
import { AppScreenBody, AppScreenShell } from '@overlay/modules-react/shell'

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
      setMemories(await overlayAppClient.memory.get<MemoryListItem[]>({ limit: 100 }))
    } catch { /* ignore */ } finally { setMemoriesLoading(false) }
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await overlayAppClient.files.get<FileNode[]>({ limit: 100 }))
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
    <>
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

      <AppScreenShell
        header={
          <KnowledgeViewHeader
            activeFolder={activeFolder}
            activeTab={activeTab}
            bulkDeleting={bulkDeleting}
            createMenuOpen={createMenuOpen}
            createMenuRef={createMenuRef}
            fileCount={filesFiltered.length}
            fileTitle={fileTitle}
            fileUploadRef={fileUploadRef}
            folderBreadcrumb={folderBreadcrumb}
            folderUploadRef={folderUploadRef}
            isSavingFile={isSavingFile}
            layout={layout}
            memoryCount={memoriesFiltered.length}
            memorySearchOpen={memorySearchOpen}
            memorySearchQuery={memorySearchQuery}
            mode={mode}
            moveFileToParent={(fileId, parentId) => void moveFileToParent(fileId, parentId)}
            navigateToFolder={navigateToFolder}
            onBulkDeleteFiles={() => void bulkDeleteFiles()}
            onBulkDeleteMemories={() => void bulkDeleteMemories()}
            onBulkDeleteOutputs={() => void bulkDeleteOutputs()}
            onCloseFile={closeFileDialog}
            onCommitOutputFilter={commitOutputFilter}
            onCreateNoteFile={() => void handleCreateNoteFile()}
            onExitSelectMode={exitSelectMode}
            onFileTitleChange={handleFileTitleChange}
            onImportMemory={() => { setShowImportMemory(true); setImportMemoryError(null) }}
            onNewMemory={() => { setShowAddMemory(true); setMemorySaveError(null) }}
            onRefreshOutputs={() => setOutputsRefreshKey((k) => k + 1)}
            onSetMemorySearchOpen={setMemorySearchOpen}
            onSetMemorySearchQuery={setMemorySearchQuery}
            onSetSelectMode={setSelectMode}
            onUpdateQuery={updateQuery}
            outputFilter={outputFilter}
            outputFilterOpen={outputFilterOpen}
            outputFilterRef={outputFilterRef}
            rootItemCount={rootNodes.length}
            selectedFile={selectedFile}
            selectedFileCount={selectedFileIds.size}
            selectedMemoryCount={selectedMemoryIds.size}
            selectedOutputCount={selectedOutputIds.size}
            selectMode={selectMode}
            setCreateMenuOpen={setCreateMenuOpen}
            setDialog={setDialog}
            setDialogName={setDialogName}
            setOutputFilterOpen={setOutputFilterOpen}
            setUploadMenuOpen={setUploadMenuOpen}
            uploadMenuOpen={uploadMenuOpen}
            uploadMenuRef={uploadMenuRef}
          />
        }
      >
        {/* ── Main content ── */}
        <AppScreenBody
          padding="none"
          maxWidth="none"
          scroll={activeTab === 'outputs' ? 'hidden' : 'auto'}
          className={`px-6 py-4 ${activeTab === 'outputs' ? 'flex flex-col' : ''}`}
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
        </AppScreenBody>
      </AppScreenShell>
    </>
  )
}
