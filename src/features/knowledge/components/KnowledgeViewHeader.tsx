'use client'

import type React from 'react'
import {
  ArrowLeft,
  ChevronRight,
  FolderInput,
  FolderOpen,
  LayoutGrid,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  SquareMousePointer,
  Trash2,
} from 'lucide-react'
import type {
  KnowledgeFileNode as FileNode,
  KnowledgeOutputFilter as OutputFilter,
  KnowledgeTab as Tab,
} from '@overlay/app-core'
import { FilesCreateUploadControls, OutputFilterMenu } from './KnowledgeToolbarMenus'

const TOOLBAR_ICON_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

const TOOLBAR_FILLED_BUTTON_CLASS =
  'flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]'

type KnowledgeLayout = 'list' | 'cards'

function SelectedFileHeader({
  fileTitle,
  isSavingFile,
  onClose,
  onTitleChange,
}: {
  fileTitle: string
  isSavingFile: boolean
  onClose: () => void
  onTitleChange: (value: string) => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        title="Back to files"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={17} />
      </button>
      <input
        type="text"
        value={fileTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="File title..."
        className="min-w-0 flex-1 bg-transparent font-medium text-xl text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        style={{ fontFamily: 'var(--font-serif)' }}
      />
      {isSavingFile ? (
        <span className="shrink-0 text-[11px] text-[var(--muted-light)]">Saving...</span>
      ) : null}
    </>
  )
}

function FolderHeader({
  activeFolder,
  folderBreadcrumb,
  itemCount,
  memorySearchOpen,
  moveFileToParent,
  navigateToFolder,
}: {
  activeFolder: FileNode
  folderBreadcrumb: FileNode[]
  itemCount: number
  memorySearchOpen: boolean
  moveFileToParent: (fileId: string, parentId: string | null) => void
  navigateToFolder: (folderId: string | null) => void
}) {
  return (
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
          moveFileToParent(fileId, activeFolder.parentId)
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
        <span className="shrink-0 text-xs text-[var(--muted-light)]">{itemCount} items</span>
      )}
    </div>
  )
}

function HeaderTitle({
  activeTab,
  fileCount,
  memoryCount,
  memorySearchOpen,
  mode,
}: {
  activeTab: Tab
  fileCount: number
  memoryCount: number
  memorySearchOpen: boolean
  mode: 'knowledge' | 'files'
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-3">
      <h1 className="text-sm font-medium text-[var(--foreground)]">
        {mode === 'files' ? 'Files' : activeTab === 'memories' ? 'Memories' : activeTab === 'files' ? 'Files' : 'Outputs'}
      </h1>
      {activeTab !== 'outputs' && !memorySearchOpen && (
        <span className="text-xs text-[var(--muted-light)]">
          {activeTab === 'memories' ? memoryCount : fileCount} items
        </span>
      )}
    </div>
  )
}

function BulkSelectControls({
  activeTab,
  bulkDeleting,
  onBulkDeleteFiles,
  onBulkDeleteMemories,
  onBulkDeleteOutputs,
  onExitSelectMode,
  onSetSelectMode,
  selectMode,
  selectedFileCount,
  selectedMemoryCount,
  selectedOutputCount,
}: {
  activeTab: Tab
  bulkDeleting: boolean
  onBulkDeleteFiles: () => void
  onBulkDeleteMemories: () => void
  onBulkDeleteOutputs: () => void
  onExitSelectMode: () => void
  onSetSelectMode: (value: boolean) => void
  selectMode: boolean
  selectedFileCount: number
  selectedMemoryCount: number
  selectedOutputCount: number
}) {
  if (activeTab !== 'memories' && activeTab !== 'files' && activeTab !== 'outputs') return null
  const selectedCount =
    activeTab === 'memories'
      ? selectedMemoryCount
      : activeTab === 'files'
        ? selectedFileCount
        : selectedOutputCount

  if (!selectMode) {
    return (
      <button
        type="button"
        title="Select items"
        onClick={() => onSetSelectMode(true)}
        className={TOOLBAR_ICON_BUTTON_CLASS}
      >
        <SquareMousePointer size={14} />
      </button>
    )
  }

  return (
    <>
      <button type="button" onClick={onExitSelectMode} className={TOOLBAR_FILLED_BUTTON_CLASS}>
        Cancel
      </button>
      <button
        type="button"
        disabled={bulkDeleting || selectedCount === 0}
        onClick={() => {
          if (activeTab === 'memories') onBulkDeleteMemories()
          else if (activeTab === 'files') onBulkDeleteFiles()
          else onBulkDeleteOutputs()
        }}
        className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={13} />
        {bulkDeleting ? 'Deleting…' : `Delete (${selectedCount})`}
      </button>
    </>
  )
}

function LayoutControls({
  layout,
  onUpdateQuery,
}: {
  layout: KnowledgeLayout
  onUpdateQuery: (updates: Record<string, string | null | undefined>) => void
}) {
  return (
    <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
      <button
        type="button"
        title="List"
        onClick={() => onUpdateQuery({ layout: 'list' })}
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
        onClick={() => onUpdateQuery({ layout: 'cards' })}
        className={`rounded px-2 py-1 transition-colors ${
          layout === 'cards'
            ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
            : 'text-[var(--muted-light)] hover:text-[var(--foreground)]'
        }`}
      >
        <LayoutGrid size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function KnowledgeViewHeader({
  activeFolder,
  activeTab,
  bulkDeleting,
  createMenuOpen,
  createMenuRef,
  fileCount,
  fileTitle,
  fileUploadRef,
  folderBreadcrumb,
  folderUploadRef,
  isSavingFile,
  layout,
  memoryCount,
  memorySearchOpen,
  memorySearchQuery,
  mode,
  moveFileToParent,
  navigateToFolder,
  onBulkDeleteFiles,
  onBulkDeleteMemories,
  onBulkDeleteOutputs,
  onCloseFile,
  onCreateNoteFile,
  onExitSelectMode,
  onFileTitleChange,
  onImportMemory,
  onNewMemory,
  onRefreshOutputs,
  onSetMemorySearchOpen,
  onSetMemorySearchQuery,
  onSetSelectMode,
  onUpdateQuery,
  outputFilter,
  outputFilterOpen,
  outputFilterRef,
  rootItemCount,
  selectedFile,
  selectedFileCount,
  selectedMemoryCount,
  selectedOutputCount,
  selectMode,
  setCreateMenuOpen,
  setDialog,
  setDialogName,
  setOutputFilterOpen,
  setUploadMenuOpen,
  uploadMenuOpen,
  uploadMenuRef,
  onCommitOutputFilter,
}: {
  activeFolder: FileNode | null
  activeTab: Tab
  bulkDeleting: boolean
  createMenuOpen: boolean
  createMenuRef: React.RefObject<HTMLDivElement | null>
  fileCount: number
  fileTitle: string
  fileUploadRef: React.RefObject<HTMLInputElement | null>
  folderBreadcrumb: FileNode[]
  folderUploadRef: React.RefObject<HTMLInputElement | null>
  isSavingFile: boolean
  layout: KnowledgeLayout
  memoryCount: number
  memorySearchOpen: boolean
  memorySearchQuery: string
  mode: 'knowledge' | 'files'
  moveFileToParent: (fileId: string, parentId: string | null) => void
  navigateToFolder: (folderId: string | null) => void
  onBulkDeleteFiles: () => void
  onBulkDeleteMemories: () => void
  onBulkDeleteOutputs: () => void
  onCloseFile: () => void
  onCreateNoteFile: () => void
  onExitSelectMode: () => void
  onFileTitleChange: (value: string) => void
  onImportMemory: () => void
  onNewMemory: () => void
  onRefreshOutputs: () => void
  onSetMemorySearchOpen: (value: boolean | ((value: boolean) => boolean)) => void
  onSetMemorySearchQuery: (value: string) => void
  onSetSelectMode: (value: boolean) => void
  onUpdateQuery: (updates: Record<string, string | null | undefined>) => void
  outputFilter: OutputFilter
  outputFilterOpen: boolean
  outputFilterRef: React.RefObject<HTMLDivElement | null>
  rootItemCount: number
  selectedFile: FileNode | null
  selectedFileCount: number
  selectedMemoryCount: number
  selectedOutputCount: number
  selectMode: boolean
  setCreateMenuOpen: (value: boolean | ((value: boolean) => boolean)) => void
  setDialog: (value: { type: 'file' | 'folder'; parentId: string | null } | null) => void
  setDialogName: (value: string) => void
  setOutputFilterOpen: (value: boolean | ((value: boolean) => boolean)) => void
  setUploadMenuOpen: (value: boolean | ((value: boolean) => boolean)) => void
  uploadMenuOpen: boolean
  uploadMenuRef: React.RefObject<HTMLDivElement | null>
  onCommitOutputFilter: (filter: OutputFilter) => void
}) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
      {selectedFile ? (
        <SelectedFileHeader
          fileTitle={fileTitle}
          isSavingFile={isSavingFile}
          onClose={onCloseFile}
          onTitleChange={onFileTitleChange}
        />
      ) : (
        <>
          {activeTab === 'files' && activeFolder ? (
            <FolderHeader
              activeFolder={activeFolder}
              folderBreadcrumb={folderBreadcrumb}
              itemCount={rootItemCount}
              memorySearchOpen={memorySearchOpen}
              moveFileToParent={moveFileToParent}
              navigateToFolder={navigateToFolder}
            />
          ) : (
            <HeaderTitle
              activeTab={activeTab}
              fileCount={fileCount}
              memoryCount={memoryCount}
              memorySearchOpen={memorySearchOpen}
              mode={mode}
            />
          )}
          {activeTab === 'memories' && memorySearchOpen ? (
            <input
              value={memorySearchQuery}
              onChange={(e) => onSetMemorySearchQuery(e.target.value)}
              placeholder="Search memories…"
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-light)] focus:border-[var(--muted)]"
            />
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex shrink-0 items-center gap-2">
            <BulkSelectControls
              activeTab={activeTab}
              bulkDeleting={bulkDeleting}
              onBulkDeleteFiles={onBulkDeleteFiles}
              onBulkDeleteMemories={onBulkDeleteMemories}
              onBulkDeleteOutputs={onBulkDeleteOutputs}
              onExitSelectMode={onExitSelectMode}
              onSetSelectMode={onSetSelectMode}
              selectMode={selectMode}
              selectedFileCount={selectedFileCount}
              selectedMemoryCount={selectedMemoryCount}
              selectedOutputCount={selectedOutputCount}
            />
            {activeTab === 'outputs' ? (
              <OutputFilterMenu
                onCommit={onCommitOutputFilter}
                open={outputFilterOpen}
                outputFilter={outputFilter}
                outputFilterRef={outputFilterRef}
                setOpen={setOutputFilterOpen}
              />
            ) : null}
            {(activeTab === 'memories' || activeTab === 'files' || activeTab === 'outputs') ? (
              <LayoutControls layout={layout} onUpdateQuery={onUpdateQuery} />
            ) : null}
            {activeTab === 'outputs' ? (
              <button
                type="button"
                title="Refresh"
                onClick={onRefreshOutputs}
                className={TOOLBAR_ICON_BUTTON_CLASS}
              >
                <RefreshCw size={14} strokeWidth={1.75} />
              </button>
            ) : null}
            {activeTab === 'memories' ? (
              <>
                <button
                  type="button"
                  title="Search memories"
                  onClick={() => onSetMemorySearchOpen((v) => !v)}
                  className={`${TOOLBAR_ICON_BUTTON_CLASS} ${
                    memorySearchOpen ? 'border-[var(--muted)] bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
                  }`}
                >
                  <Search size={14} strokeWidth={1.75} />
                </button>
                <button type="button" onClick={onImportMemory} className={TOOLBAR_FILLED_BUTTON_CLASS}>
                  <FolderInput size={13} />
                  Import
                </button>
                <button type="button" onClick={onNewMemory} className={TOOLBAR_FILLED_BUTTON_CLASS}>
                  <Plus size={13} />
                  New Memory
                </button>
              </>
            ) : activeTab === 'files' ? (
              <FilesCreateUploadControls
                activeFolder={activeFolder}
                createMenuOpen={createMenuOpen}
                createMenuRef={createMenuRef}
                fileUploadRef={fileUploadRef}
                folderUploadRef={folderUploadRef}
                mode={mode}
                onCreateNoteFile={onCreateNoteFile}
                setCreateMenuOpen={setCreateMenuOpen}
                setDialog={setDialog}
                setDialogName={setDialogName}
                setUploadMenuOpen={setUploadMenuOpen}
                uploadMenuOpen={uploadMenuOpen}
                uploadMenuRef={uploadMenuRef}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
