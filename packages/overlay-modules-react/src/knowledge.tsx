'use client'

import { useState, type ChangeEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { BookOpen, Brain, Check, Copy, FileText, Folder, Loader2, Search, Trash2, X } from 'lucide-react'
import type { KnowledgeFile, KnowledgeFileNode, MemoryRow, OutputSummary } from '@overlay/app-core'
import { IMPORT_MEMORY_PROMPT, filePathLabel } from '@overlay/app-core'
import type { TreeNode } from '@overlay/app-core/modules'
import { Badge, Button, EmptyState, FileTreeSkeleton, KnowledgeListSkeleton, TabButton, TabsList, cn } from '@overlay/ui'

export interface KnowledgeModuleShellProps {
  title?: ReactNode
  activeTab: string
  tabs: readonly { id: string; label: ReactNode; disabled?: boolean }[]
  onTabChange?: (tabId: string) => void
  actions?: ReactNode
  children: ReactNode
}

export function KnowledgeModuleShell({
  title = 'Knowledge',
  activeTab,
  tabs,
  onTabChange,
  actions,
  children,
}: KnowledgeModuleShellProps) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <TabsList>
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                active={tab.id === activeTab}
                disabled={tab.disabled}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.label}
              </TabButton>
            ))}
          </TabsList>
          {actions}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}

export interface KnowledgeFileTreeProps {
  nodes: readonly TreeNode<KnowledgeFile>[]
  selectedId?: string | null
  loading?: boolean
  emptyLabel?: ReactNode
  onSelectFile?: (file: KnowledgeFile) => void
  renderActions?: (file: KnowledgeFile) => ReactNode
}

export function KnowledgeFileTree({
  nodes,
  selectedId,
  loading,
  emptyLabel = 'No files yet',
  onSelectFile,
  renderActions,
}: KnowledgeFileTreeProps) {
  if (loading) {
    return <div className="p-4 text-xs text-[var(--muted)]">Loading files...</div>
  }
  if (nodes.length === 0) {
    return <EmptyState className="h-full min-h-48" title={emptyLabel} />
  }
  return (
    <div className="py-2">
      {nodes.map((node) => (
        <KnowledgeFileTreeRow
          key={node.item._id}
          node={node}
          selectedId={selectedId}
          onSelectFile={onSelectFile}
          renderActions={renderActions}
        />
      ))}
    </div>
  )
}

function KnowledgeFileTreeRow({
  node,
  selectedId,
  onSelectFile,
  renderActions,
}: {
  node: TreeNode<KnowledgeFile>
  selectedId?: string | null
  onSelectFile?: (file: KnowledgeFile) => void
  renderActions?: (file: KnowledgeFile) => ReactNode
}) {
  const file = node.item
  const isFolder = file.kind === 'folder' || file.type === 'folder'
  return (
    <div>
      <div
        className={cn(
          'group/row flex min-h-9 items-center gap-2 px-3 text-sm transition-colors',
          selectedId === file._id
            ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
        )}
        style={{ paddingLeft: 12 + node.depth * 16 }}
      >
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onSelectFile?.(file)}
        >
          <span className="mr-2 text-[10px] text-[var(--muted-light)]">{isFolder ? 'Folder' : 'File'}</span>
          {file.name}
        </button>
        {renderActions ? (
          <div className="hidden shrink-0 items-center gap-1 group-hover/row:flex">{renderActions(file)}</div>
        ) : null}
      </div>
      {node.children.map((child) => (
        <KnowledgeFileTreeRow
          key={child.item._id}
          node={child}
          selectedId={selectedId}
          onSelectFile={onSelectFile}
          renderActions={renderActions}
        />
      ))}
    </div>
  )
}

export interface OutputGalleryProps {
  outputs: readonly OutputSummary[]
  loading?: boolean
  onOpenOutput?: (output: OutputSummary) => void
  onDeleteOutput?: (output: OutputSummary) => void
}

export function OutputGallery({ outputs, loading, onOpenOutput, onDeleteOutput }: OutputGalleryProps) {
  if (loading) return <div className="p-4 text-xs text-[var(--muted)]">Loading outputs...</div>
  if (outputs.length === 0) return <EmptyState className="h-full min-h-48" title="No outputs yet" />
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {outputs.map((output) => (
        <article
          key={output._id}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{output.fileName ?? output.type}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{output.prompt}</p>
            </div>
            <Badge variant={output.status === 'failed' ? 'danger' : output.status === 'pending' ? 'warning' : 'success'}>
              {output.status}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpenOutput?.(output)}>
              Open
            </Button>
            {onDeleteOutput ? (
              <Button size="sm" variant="ghost" onClick={() => onDeleteOutput(output)}>
                Delete
              </Button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export interface MemoryListProps {
  memories: readonly MemoryRow[]
  loading?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleMemory?: (memory: MemoryRow) => void
}

export function MemoryList({ memories, loading, selectedIds, onToggleMemory }: MemoryListProps) {
  if (loading) return <div className="p-4 text-xs text-[var(--muted)]">Loading memories...</div>
  if (memories.length === 0) return <EmptyState className="h-full min-h-48" title="No memories yet" />
  return (
    <div className="divide-y divide-[var(--border)]">
      {memories.map((memory) => (
        <button
          key={memory.key}
          type="button"
          onClick={() => onToggleMemory?.(memory)}
          className={cn(
            'block w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]',
            selectedIds?.has(memory.memoryId) ? 'bg-[var(--surface-subtle)]' : '',
          )}
        >
          <p className="text-sm leading-6 text-[var(--foreground)]">{memory.content}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="muted">{memory.source}</Badge>
            {memory.status ? <Badge variant="muted">{memory.status}</Badge> : null}
          </div>
        </button>
      ))}
    </div>
  )
}

const DIALOG_ACTION_BUTTON_CLASS =
  'px-3 py-1.5 rounded-md text-xs border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)] transition-colors hover:bg-[var(--border)]'

export function KnowledgePendingNotice({
  title,
  preview,
}: {
  title: ReactNode
  preview: ReactNode
}) {
  return (
    <div
      className="mx-auto mb-4 flex max-w-3xl items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3"
      aria-busy
      aria-live="polite"
    >
      <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-[var(--muted)]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--foreground)]">{title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">{preview}</p>
      </div>
    </div>
  )
}

export function KnowledgeEmptyState({
  kind,
  message,
  actionLabel,
  onAction,
}: {
  kind: 'memory' | 'file' | 'search'
  message: ReactNode
  actionLabel?: ReactNode
  onAction?: () => void
}) {
  const Icon = kind === 'memory' ? Brain : kind === 'file' ? FileText : Search
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-[var(--muted-light)]">
      <Icon size={32} strokeWidth={1} className="opacity-40" />
      <p className="text-sm">{message}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="text-xs text-[var(--foreground)] underline underline-offset-2"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function AddMemoryDialog({
  value,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  value: string
  saving: boolean
  error?: string | null
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-[480px] max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Add memory</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type or paste memory content..."
          autoFocus
          rows={5}
          onKeyDown={(event) => { if (event.key === 'Enter' && event.metaKey) onSave() }}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
        />
        <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
          Long memories stay as one saved item; the list shows short previews so you can scan them quickly.
        </p>
        {error ? <p className="mt-3 text-xs text-red-400" role="alert">{error}</p> : null}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className={DIALOG_ACTION_BUTTON_CLASS}>Cancel</button>
          <button
            onClick={onSave}
            disabled={!value.trim() || saving}
            className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ImportMemoryDialog({
  value,
  saving,
  error,
  promptCopied,
  onChange,
  onClose,
  onSave,
  onCopyPrompt,
}: {
  value: string
  saving: boolean
  error?: string | null
  promptCopied: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  onCopyPrompt: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-[540px] max-w-[92vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Import memory</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mb-5 flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[10px] font-semibold text-[var(--background)]">1</span>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium text-[var(--foreground)]">Copy this prompt into a chat with your other AI provider</p>
            <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 pb-10 pt-3">
              <p className="text-xs leading-relaxed text-[var(--foreground)]">{IMPORT_MEMORY_PROMPT}</p>
              <button
                type="button"
                onClick={onCopyPrompt}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
              >
                {promptCopied ? <Check size={11} /> : <Copy size={11} />}
                {promptCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <div className="mb-5 flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[10px] font-semibold text-[var(--background)]">2</span>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium text-[var(--foreground)]">Paste results below to add to your memory</p>
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Paste your memory details here"
              rows={6}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
            />
          </div>
        </div>
        {error ? <p className="mb-3 text-xs text-red-400" role="alert">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={DIALOG_ACTION_BUTTON_CLASS}>Cancel</button>
          <button
            onClick={onSave}
            disabled={!value.trim() || saving}
            className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
          >
            {saving ? 'Saving…' : 'Add to memory'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreateKnowledgeItemDialog({
  type,
  value,
  creating,
  onChange,
  onClose,
  onCreate,
}: {
  type: 'file' | 'folder'
  value: string
  creating: boolean
  onChange: (value: string) => void
  onClose: () => void
  onCreate: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)]"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="w-[400px] max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            New {type === 'folder' ? 'folder' : 'file'}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <X size={14} />
          </button>
        </div>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={type === 'folder' ? 'Folder name' : 'filename.txt'}
          autoFocus
          onKeyDown={(event) => { if (event.key === 'Enter') onCreate() }}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className={DIALOG_ACTION_BUTTON_CLASS}>Cancel</button>
          <button
            onClick={onCreate}
            disabled={!value.trim() || creating}
            className={`${DIALOG_ACTION_BUTTON_CLASS} disabled:opacity-40`}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MemoryDetailDialog({
  memory,
  onClose,
  onDelete,
}: {
  memory: MemoryRow
  onClose: () => void
  onDelete: (memoryId: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--foreground)]">Memory</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-light)]">
              {new Date(memory.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => onDelete(memory.memoryId)}
              className="rounded-md p-1.5 text-[var(--muted-light)] transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{memory.fullContent}</p>
          {memory.source ? <p className="mt-4 text-xs text-[var(--muted-light)]">Source: {memory.source}</p> : null}
        </div>
      </div>
    </div>
  )
}

export function KnowledgeMemoryList({
  memories,
  selectedIds,
  selectMode,
  onOpen,
  onToggleSelect,
  onDelete,
}: {
  memories: readonly MemoryRow[]
  selectedIds: ReadonlySet<string>
  selectMode: boolean
  onOpen: (memory: MemoryRow) => void
  onToggleSelect: (memoryId: string) => void
  onDelete: (memoryId: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-0.5">
      {memories.map((memory) => {
        const bulkSel = selectedIds.has(memory.memoryId)
        return (
          <div
            key={memory.key}
            role="button"
            tabIndex={0}
            onClick={() => (selectMode ? onToggleSelect(memory.memoryId) : onOpen(memory))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (selectMode) onToggleSelect(memory.memoryId)
                else onOpen(memory)
              }
            }}
            className={`group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-muted)] ${
              bulkSel ? 'border-[var(--border)] bg-[var(--surface-muted)]' : ''
            }`}
          >
            {selectMode ? <BulkSelectMarker selected={bulkSel} className="mt-0.5 shrink-0" /> : null}
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--foreground)]">{memory.content}</p>
            {!selectMode ? (
              <button
                type="button"
                onClick={(event) => onDelete(memory.memoryId, event)}
                className="shrink-0 rounded p-1 text-[var(--muted-light)] opacity-0 transition-opacity hover:bg-[var(--surface-subtle)] hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function KnowledgeMemoryCards({
  memories,
  selectedIds,
  selectMode,
  onOpen,
  onToggleSelect,
}: {
  memories: readonly MemoryRow[]
  selectedIds: ReadonlySet<string>
  selectMode: boolean
  onOpen: (memory: MemoryRow) => void
  onToggleSelect: (memoryId: string) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3">
      {memories.map((memory) => {
        const bulkSel = selectedIds.has(memory.memoryId)
        return (
          <button
            key={memory.key}
            type="button"
            onClick={() => (selectMode ? onToggleSelect(memory.memoryId) : onOpen(memory))}
            className={`group relative mb-4 block w-full break-inside-avoid rounded-xl border bg-[var(--surface-elevated)] p-4 text-left transition-shadow hover:shadow-md ${
              bulkSel ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
            }`}
            style={{ breakInside: 'avoid' }}
          >
            {selectMode ? <BulkSelectMarker selected={bulkSel} className="absolute left-3 top-3 z-10" /> : null}
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
  )
}

function BulkSelectMarker({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded border border-[var(--border)]',
        selected ? 'border-[var(--foreground)] bg-[var(--foreground)]' : 'bg-[var(--surface-elevated)]',
        className,
      )}
      aria-hidden
    >
      {selected ? <span className="text-[10px] leading-none text-[var(--background)]">✓</span> : null}
    </span>
  )
}

export function KnowledgeFileList({
  nodes,
  selectedId,
  selectedIds,
  selectMode,
  onSelect,
  onFolderOpen,
  onDelete,
  onToggleBulk,
  onMove,
}: {
  nodes: readonly KnowledgeFileNode[]
  selectedId: string | null
  selectedIds?: ReadonlySet<string>
  selectMode?: boolean
  onSelect: (node: KnowledgeFileNode) => void
  onFolderOpen: (folderId: string) => void
  onDelete: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onToggleBulk?: (id: string) => void
  onMove?: (fileId: string, parentId: string | null) => void
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-0.5">
      {nodes.map((node) => (
        <FileTreeRow
          key={node._id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          onFolderOpen={onFolderOpen}
          onDelete={onDelete}
          bulkSelectMode={selectMode}
          bulkSelectedIds={selectedIds}
          onToggleBulk={onToggleBulk}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

export function FileTreeRow({
  node,
  selectedId,
  onSelect,
  onFolderOpen,
  onDelete,
  bulkSelectMode = false,
  bulkSelectedIds,
  onToggleBulk,
  onMove,
}: {
  node: KnowledgeFileNode
  selectedId: string | null
  onSelect: (node: KnowledgeFileNode) => void
  onFolderOpen: (folderId: string) => void
  onDelete: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  bulkSelectMode?: boolean
  bulkSelectedIds?: ReadonlySet<string>
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
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-overlay-file-id', node._id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(event) => {
          if (node.type !== 'folder' || !onMove) return
          const draggingId = event.dataTransfer.types.includes('application/x-overlay-file-id')
          if (!draggingId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          if (node.type !== 'folder' || !onMove) return
          event.preventDefault()
          setDragOver(false)
          const fileId = event.dataTransfer.getData('application/x-overlay-file-id')
          if (!fileId || fileId === node._id) return
          onMove(fileId, node._id)
        }}
        onClick={handleRowClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
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
        {bulkSelectMode ? <BulkSelectMarker selected={isBulkSelected} className="mt-0.5 shrink-0" /> : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {node.type === 'folder' ? (
            <Folder size={14} className="shrink-0 text-[var(--muted-light)]" />
          ) : node.kind === 'note' ? (
            <BookOpen size={14} className="shrink-0 text-[var(--muted-light)]" />
          ) : (
            <FileText size={14} className="shrink-0 text-[var(--muted-light)]" />
          )}
          <span className="min-w-0 flex-1 truncate leading-relaxed">{node.name}</span>
        </div>
        {!bulkSelectMode ? (
          <button
            type="button"
            onClick={(event) => onDelete(node._id, event)}
            className="shrink-0 rounded p-1 text-[var(--muted-light)] opacity-0 transition-opacity hover:bg-[var(--surface-subtle)] hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function KnowledgeFileCards({
  folders,
  files,
  allFiles,
  selectedIds,
  selectMode,
  onOpenFolder,
  onOpenFile,
  onToggleBulk,
  onMove,
}: {
  folders: readonly KnowledgeFileNode[]
  files: readonly KnowledgeFileNode[]
  allFiles: readonly KnowledgeFileNode[]
  selectedIds: ReadonlySet<string>
  selectMode: boolean
  onOpenFolder: (folderId: string) => void
  onOpenFile: (file: KnowledgeFileNode) => void
  onToggleBulk: (fileId: string) => void
  onMove?: (fileId: string, parentId: string | null) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4">
      {folders.map((folder) => (
        <FolderCard
          key={folder._id}
          folder={folder}
          bulkSel={selectedIds.has(folder._id)}
          selectMode={selectMode}
          onOpen={() => (selectMode ? onToggleBulk(folder._id) : onOpenFolder(folder._id))}
          onMove={onMove}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={file._id}
          file={file}
          allFiles={allFiles}
          bulkSel={selectedIds.has(file._id)}
          selectMode={selectMode}
          onOpen={() => (selectMode ? onToggleBulk(file._id) : onOpenFile(file))}
        />
      ))}
    </div>
  )
}

export function FileCard({
  file,
  allFiles,
  bulkSel,
  selectMode,
  onOpen,
}: {
  file: KnowledgeFileNode
  allFiles: readonly KnowledgeFileNode[]
  bulkSel: boolean
  selectMode: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      draggable={!selectMode}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-overlay-file-id', file._id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className={`group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border bg-[var(--surface-elevated)] text-left transition-shadow hover:shadow-md ${
        bulkSel ? 'border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20' : 'border-[var(--border)]'
      }`}
      style={{ breakInside: 'avoid' }}
    >
      {selectMode ? <BulkSelectMarker selected={bulkSel} className="absolute left-3 top-3 z-10" /> : null}
      <div className="flex h-28 items-center justify-center bg-[var(--surface-muted)]">
        <FileText size={36} className="text-[var(--muted-light)]" />
      </div>
      <div className="px-3 py-2">
        <p className="line-clamp-2 text-xs font-medium text-[var(--foreground)]">{file.name}</p>
        <p className="mt-1 line-clamp-2 text-[10px] text-[var(--muted)]">{filePathLabel(allFiles, file)}</p>
        <p className="mt-1 text-[10px] text-[var(--muted-light)]">
          {new Date(file.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </button>
  )
}

export function FolderCard({
  folder,
  bulkSel,
  selectMode,
  onOpen,
  onMove,
}: {
  folder: KnowledgeFileNode
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
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-overlay-file-id', folder._id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => {
        if (!onMove) return
        if (!event.dataTransfer.types.includes('application/x-overlay-file-id')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!onMove) return
        event.preventDefault()
        setDragOver(false)
        const fileId = event.dataTransfer.getData('application/x-overlay-file-id')
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

function KnowledgeFileCardsSkeleton({ cards = 10 }: { cards?: number }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] columns-1 gap-4 [column-gap:1rem] sm:columns-2 lg:columns-3 xl:columns-4" aria-hidden>
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]"
          style={{ breakInside: 'avoid' }}
        >
          <div className="flex h-28 items-center justify-center bg-[var(--surface-muted)]">
            <div className="ui-skeleton-line h-9 w-9 rounded-md" />
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <div className={`ui-skeleton-line h-3 rounded ${index % 3 === 0 ? 'w-4/5' : index % 3 === 1 ? 'w-3/5' : 'w-2/3'}`} />
            <div className="ui-skeleton-line h-2.5 w-2/5 rounded opacity-75" />
            <div className="ui-skeleton-line h-2 w-1/4 rounded opacity-60" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function KnowledgeFilesPanel({
  loading,
  filesCount,
  nodes,
  folders,
  flatFiles,
  allFiles,
  layout,
  selectedFileId,
  selectedIds,
  selectMode,
  onCreateFirstMemory,
  onSelect,
  onFolderOpen,
  onDelete,
  onToggleBulk,
  onMove,
}: {
  loading: boolean
  filesCount: number
  nodes: readonly KnowledgeFileNode[]
  folders: readonly KnowledgeFileNode[]
  flatFiles: readonly KnowledgeFileNode[]
  allFiles: readonly KnowledgeFileNode[]
  layout: 'list' | 'cards'
  selectedFileId: string | null
  selectedIds: ReadonlySet<string>
  selectMode: boolean
  onCreateFirstMemory?: () => void
  onSelect: (node: KnowledgeFileNode) => void
  onFolderOpen: (folderId: string) => void
  onDelete: (id: string, event: MouseEvent<HTMLButtonElement>) => void
  onToggleBulk: (id: string) => void
  onMove: (fileId: string, parentId: string | null) => void
}) {
  void onCreateFirstMemory
  if (loading) {
    return layout === 'cards' ? <KnowledgeFileCardsSkeleton /> : <FileTreeSkeleton rows={10} />
  }
  if (filesCount === 0) return <KnowledgeEmptyState kind="file" message="No files yet" />
  if (nodes.length === 0) return <KnowledgeEmptyState kind="search" message="No files match your search" />
  if (layout === 'list') {
    return (
      <KnowledgeFileList
        nodes={nodes}
        selectedId={selectedFileId}
        selectedIds={selectedIds}
        selectMode={selectMode}
        onSelect={onSelect}
        onFolderOpen={onFolderOpen}
        onDelete={onDelete}
        onToggleBulk={onToggleBulk}
        onMove={onMove}
      />
    )
  }
  return (
    <KnowledgeFileCards
      folders={folders}
      files={flatFiles}
      allFiles={allFiles}
      selectedIds={selectedIds}
      selectMode={selectMode}
      onOpenFolder={onFolderOpen}
      onOpenFile={onSelect}
      onToggleBulk={onToggleBulk}
      onMove={onMove}
    />
  )
}

export function KnowledgeMemoriesPanel({
  loading,
  memoriesCount,
  memories,
  layout,
  selectedIds,
  selectMode,
  hasPending,
  onOpen,
  onToggleSelect,
  onDelete,
  onAddFirst,
}: {
  loading: boolean
  memoriesCount: number
  memories: readonly MemoryRow[]
  layout: 'list' | 'cards'
  selectedIds: ReadonlySet<string>
  selectMode: boolean
  hasPending: boolean
  onOpen: (memory: MemoryRow) => void
  onToggleSelect: (memoryId: string) => void
  onDelete: (memoryId: string, event: MouseEvent<HTMLButtonElement>) => void
  onAddFirst: () => void
}) {
  if (loading) return <KnowledgeListSkeleton rows={10} />
  if (memoriesCount === 0 && !hasPending) {
    return (
      <KnowledgeEmptyState
        kind="memory"
        message="No memories yet"
        actionLabel="Add your first memory"
        onAction={onAddFirst}
      />
    )
  }
  if (memoriesCount > 0 && memories.length === 0) {
    return <KnowledgeEmptyState kind="search" message="No memories match your search" />
  }
  if (layout === 'list') {
    return (
      <KnowledgeMemoryList
        memories={memories}
        selectedIds={selectedIds}
        selectMode={selectMode}
        onOpen={onOpen}
        onToggleSelect={onToggleSelect}
        onDelete={onDelete}
      />
    )
  }
  return (
    <KnowledgeMemoryCards
      memories={memories}
      selectedIds={selectedIds}
      selectMode={selectMode}
      onOpen={onOpen}
      onToggleSelect={onToggleSelect}
    />
  )
}

export function HiddenKnowledgeFileInputs({
  fileUploadRef,
  folderUploadRef,
  onFileChange,
  onFolderChange,
}: {
  fileUploadRef: RefObject<HTMLInputElement | null>
  folderUploadRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <>
      <input ref={fileUploadRef} type="file" className="hidden" onChange={onFileChange} />
      <input
        ref={folderUploadRef}
        type="file"
        className="hidden"
        onChange={onFolderChange}
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
      />
    </>
  )
}
