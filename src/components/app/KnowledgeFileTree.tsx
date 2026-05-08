'use client'

import { useState } from 'react'
import { Folder, FileText, BookOpen, Trash2 } from 'lucide-react'

export interface FileNode {
  _id: string
  name: string
  type: 'file' | 'folder'
  kind?: 'folder' | 'note' | 'upload' | 'output'
  parentId: string | null
  content?: string
  textContent?: string
  mimeType?: string
  extension?: string
  sizeBytes?: number
  isStorageBacked?: boolean
  downloadUrl?: string
  outputType?: string
  createdAt: number
  updatedAt: number
}

export function opensInDocumentEditor(file: FileNode): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
}

export function filePathLabel(all: FileNode[], file: FileNode): string {
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

export function FileTreeRow({
  node, selectedId, onSelect, onFolderOpen, onDelete,
  bulkSelectMode = false,
  bulkSelectedIds,
  onToggleBulk,
  onMove,
}: {
  node: FileNode
  selectedId: string | null
  onSelect: (node: FileNode) => void
  onFolderOpen: (folderId: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  bulkSelectMode?: boolean
  bulkSelectedIds?: Set<string>
  onToggleBulk?: (id: string) => void
  onMove?: (fileId: string, parentId: string | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const isFileViewerSelected = node.type === 'file' && node._id === selectedId
  const isBulkSelected = Boolean(bulkSelectedIds?.has(node._id))

  function handleRowClick() {
    if (bulkSelectMode && onToggleBulk) {
      onToggleBulk(node._id)
      return
    }
    if (node.type === 'folder') onFolderOpen(node._id)
    else onSelect(node)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        draggable={!bulkSelectMode}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-overlay-file-id', node._id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          if (node.type !== 'folder' || !onMove) return
          const draggingId = e.dataTransfer.types.includes('application/x-overlay-file-id')
          if (!draggingId) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (node.type !== 'folder' || !onMove) return
          e.preventDefault()
          setDragOver(false)
          const fileId = e.dataTransfer.getData('application/x-overlay-file-id')
          if (!fileId || fileId === node._id) return
          onMove(fileId, node._id)
        }}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleRowClick()
          }
        }}
        className={`group flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-muted)] ${
          dragOver
            ? 'border-[var(--foreground)] bg-[var(--surface-muted)]'
            : isFileViewerSelected && !bulkSelectMode
              ? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]'
              : isBulkSelected
                ? 'border-[var(--border)] bg-[var(--surface-muted)]'
                : 'border-transparent text-[var(--foreground)]'
        }`}
        style={{ paddingLeft: '12px' }}
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
            <Folder size={14} className="shrink-0 text-[var(--muted-light)]" />
          ) : (
            node.kind === 'note'
              ? <BookOpen size={14} className="shrink-0 text-[var(--muted-light)]" />
              : <FileText size={14} className="shrink-0 text-[var(--muted-light)]" />
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
    </div>
  )
}

export function FolderCard({
  folder, bulkSel, selectMode, onOpen, onMove,
}: {
  folder: FileNode
  bulkSel: boolean
  selectMode: boolean
  onOpen: () => void
  onMove?: (fileId: string, parentId: string | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <button
      type="button"
      draggable={!selectMode}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-overlay-file-id', folder._id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!onMove) return
        if (!e.dataTransfer.types.includes('application/x-overlay-file-id')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!onMove) return
        e.preventDefault()
        setDragOver(false)
        const fileId = e.dataTransfer.getData('application/x-overlay-file-id')
        if (!fileId || fileId === folder._id) return
        onMove(fileId, folder._id)
      }}
      onClick={onOpen}
      className={`group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-[var(--surface-elevated)] text-left transition-shadow hover:shadow-md ${
        dragOver
          ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20'
          : bulkSel ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
      }`}
      style={{ breakInside: 'avoid' }}
    >
      <div className="flex h-28 items-center justify-center bg-[var(--surface-muted)]">
        <Folder size={36} className="text-[var(--muted-light)]" />
      </div>
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-xs font-medium text-[var(--foreground)]">{folder.name}</p>
        <p className="mt-1 text-[10px] text-[var(--muted-light)]">Folder</p>
      </div>
    </button>
  )
}
