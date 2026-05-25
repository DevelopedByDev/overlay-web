'use client'

import { useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Loader2, MessageSquare, Pencil, Plug, Plus, Settings, Trash2, Upload } from 'lucide-react'
import { ProjectAvatar } from './project-avatar'
import type {
  ConversationSummary,
  KnowledgeFile,
  NoteDoc,
  ProjectChatSummary,
  ProjectFileSummary,
  ProjectHubTab,
  ProjectNoteSummary,
  ProjectResourceItems,
  ProjectRouteView,
  ProjectSummary,
} from '@overlay/app-core'
import { childProjectFiles, projectRouteViewForFile, rootProjectFiles } from '@overlay/app-core'
import type { TreeNode } from '@overlay/app-core/modules'
import { Badge, Button, EmptyState, cn } from '@overlay/ui'

export interface ProjectsModuleShellProps {
  projects: readonly TreeNode<ProjectSummary>[]
  selectedProjectId?: string | null
  loading?: boolean
  sidebarActions?: ReactNode
  detail?: ReactNode
  onSelectProject?: (project: ProjectSummary) => void
  onCreateProject?: () => void
  onRenameProject?: (project: ProjectSummary) => void
  onDeleteProject?: (project: ProjectSummary) => void
}

export function ProjectsModuleShell({
  projects,
  selectedProjectId,
  loading,
  sidebarActions,
  detail,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectsModuleShellProps) {
  return (
    <section className="flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
          <h1 className="text-sm font-semibold">Projects</h1>
          <div className="flex items-center gap-1">
            {sidebarActions}
            {onCreateProject ? (
              <Button size="sm" variant="ghost" onClick={onCreateProject}>
                New
              </Button>
            ) : null}
          </div>
        </div>
        <ProjectTree
          nodes={projects}
          selectedProjectId={selectedProjectId}
          loading={loading}
          onSelectProject={onSelectProject}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
        />
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        {detail ?? <EmptyState className="h-full" title="Select a project" />}
      </main>
    </section>
  )
}

export interface ProjectTreeProps {
  nodes: readonly TreeNode<ProjectSummary>[]
  selectedProjectId?: string | null
  loading?: boolean
  onSelectProject?: (project: ProjectSummary) => void
  onRenameProject?: (project: ProjectSummary) => void
  onDeleteProject?: (project: ProjectSummary) => void
}

export function ProjectTree({
  nodes,
  selectedProjectId,
  loading,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
}: ProjectTreeProps) {
  if (loading) return <div className="px-3 py-3 text-xs text-[var(--muted)]">Loading projects...</div>
  if (nodes.length === 0) return <EmptyState className="h-full px-4" title="No projects yet" />
  return (
    <div className="min-h-0 flex-1 overflow-auto py-2">
      {nodes.map((node) => (
        <ProjectTreeRow
          key={node.item._id}
          node={node}
          selectedProjectId={selectedProjectId}
          onSelectProject={onSelectProject}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
        />
      ))}
    </div>
  )
}

function ProjectTreeRow({
  node,
  selectedProjectId,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
}: {
  node: TreeNode<ProjectSummary>
  selectedProjectId?: string | null
  onSelectProject?: (project: ProjectSummary) => void
  onRenameProject?: (project: ProjectSummary) => void
  onDeleteProject?: (project: ProjectSummary) => void
}) {
  const project = node.item
  return (
    <div>
      <div
        className={cn(
          'group/row flex min-h-9 items-center gap-2 px-3 text-sm transition-colors',
          selectedProjectId === project._id
            ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
        )}
        style={{ paddingLeft: 12 + node.depth * 16 }}
      >
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onSelectProject?.(project)}
        >
          {project.name}
        </button>
        <div className="hidden shrink-0 items-center gap-1 group-hover/row:flex">
          {onRenameProject ? (
            <button type="button" className="text-xs text-[var(--muted)]" onClick={() => onRenameProject(project)}>
              Rename
            </button>
          ) : null}
          {onDeleteProject ? (
            <button type="button" className="text-xs text-[var(--muted)]" onClick={() => onDeleteProject(project)}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
      {node.children.map((child) => (
        <ProjectTreeRow
          key={child.item._id}
          node={child}
          selectedProjectId={selectedProjectId}
          onSelectProject={onSelectProject}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
        />
      ))}
    </div>
  )
}

export interface ProjectDetailProps {
  project: ProjectSummary | null
  conversations?: readonly ConversationSummary[]
  notes?: readonly NoteDoc[]
  files?: readonly KnowledgeFile[]
  actions?: ReactNode
}

export function ProjectDetail({ project, conversations = [], notes = [], files = [], actions }: ProjectDetailProps) {
  if (!project) return <EmptyState className="h-full" title="Select a project" />
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{project.name}</h2>
          {project.instructions ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{project.instructions}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ProjectStat label="Chats" value={conversations.length} />
        <ProjectStat label="Notes" value={notes.length} />
        <ProjectStat label="Files" value={files.length} />
      </div>
      <div className="mt-6 space-y-3">
        {[...conversations, ...notes, ...files].slice(0, 8).map((item) => (
          <div key={item._id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
            <p className="truncate text-sm font-medium">{'title' in item ? item.title : item.name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xl font-semibold">{value}</p>
        <Badge variant="muted">{label.toLowerCase()}</Badge>
      </div>
    </div>
  )
}

export const PROJECT_TREE_GUTTER_PX = 8
export const PROJECT_TREE_DEPTH_STEP_PX = 16
export const PROJECT_TREE_CHEVRON_COL = 'w-[22px] shrink-0 flex items-center justify-center'
export const PROJECT_TREE_ICON_COL = 'w-[14px] shrink-0 flex items-center justify-center text-[#888]'

export interface ProjectFileTreeNodeProps {
  file: ProjectFileSummary
  allFiles: readonly ProjectFileSummary[]
  depth: number
  baseIndentPx: number
  legacyInline?: boolean
  expandedIds: ReadonlySet<string>
  onToggleFolder: (id: string, event: MouseEvent) => void
  onOpenFile: (id: string) => void
  onDeleteFile: (id: string, event: MouseEvent) => void
}

export function ProjectFileTreeNode({
  file,
  allFiles,
  depth,
  baseIndentPx,
  legacyInline = false,
  expandedIds,
  onToggleFolder,
  onOpenFile,
  onDeleteFile,
}: ProjectFileTreeNodeProps) {
  const children = childProjectFiles(allFiles, file._id)
  const isFolder = file.type === 'folder'
  const open = expandedIds.has(file._id)
  const rowPadLeft = legacyInline
    ? baseIndentPx + depth * 12
    : baseIndentPx + depth * PROJECT_TREE_DEPTH_STEP_PX

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (isFolder) onToggleFolder(file._id, event as unknown as MouseEvent)
            else onOpenFile(file._id)
          }
        }}
        className={`group flex items-center gap-1.5 py-1.5 rounded-md text-xs text-[#525252] transition-colors ${
          file.type === 'file' ? 'cursor-pointer hover:bg-[#ebebeb] hover:text-[#0a0a0a]' : 'cursor-pointer hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: `${rowPadLeft}px`, paddingRight: '8px' }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return
          if (isFolder) onToggleFolder(file._id, event)
          else onOpenFile(file._id)
        }}
      >
        {legacyInline ? (
          isFolder ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFolder(file._id, event)
                }}
                className="shrink-0 p-0.5 rounded hover:bg-[#d8d8d8] transition-colors"
              >
                <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
              </button>
              {open
                ? <FolderOpen size={12} className="shrink-0 text-[#888]" />
                : <Folder size={12} className="shrink-0 text-[#888]" />}
            </>
          ) : (
            <>
              <span className="w-[18px] shrink-0 inline-block" />
              <FileText size={12} className="shrink-0 text-[#888]" />
            </>
          )
        ) : isFolder ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleFolder(file._id, event)
              }}
              className={`${PROJECT_TREE_CHEVRON_COL} p-0.5 rounded hover:bg-[#d8d8d8] transition-colors`}
            >
              <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            <div className={PROJECT_TREE_ICON_COL}>
              {open ? <FolderOpen size={12} /> : <Folder size={12} />}
            </div>
          </>
        ) : (
          <>
            <div className={PROJECT_TREE_CHEVRON_COL} aria-hidden />
            <div className={PROJECT_TREE_ICON_COL}>
              <FileText size={12} />
            </div>
          </>
        )}
        <span className="flex-1 truncate">{file.name}</span>
        <button
          type="button"
          onClick={(event) => onDeleteFile(file._id, event)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>
      {isFolder && open && children.map((child) => (
        <ProjectFileTreeNode
          key={child._id}
          file={child}
          allFiles={allFiles}
          depth={depth + 1}
          baseIndentPx={baseIndentPx}
          legacyInline={legacyInline}
          expandedIds={expandedIds}
          onToggleFolder={onToggleFolder}
          onOpenFile={onOpenFile}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </div>
  )
}

const panelItemClass =
  'group flex h-7 items-center gap-2 rounded-md px-2.5 py-0 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'

const inlineConfirmDeleteButtonClass =
  'ml-1 inline-flex h-5 shrink-0 items-center rounded-full bg-red-500/15 px-2 text-[11px] font-medium leading-none text-red-500 transition-colors hover:bg-red-500/25'

export interface FilesInlineBranchProps {
  file: ProjectFileSummary
  allFiles: readonly ProjectFileSummary[]
  depth: number
  expanded: ReadonlySet<string>
  activeFileId: string | null
  onToggle: (fileId: string) => void
  onOpen: (file: ProjectFileSummary) => void
  onMove: (fileId: string, parentId: string | null) => void
}

export function FilesInlineBranch({
  file,
  allFiles,
  depth,
  expanded,
  activeFileId,
  onToggle,
  onOpen,
  onMove,
}: FilesInlineBranchProps) {
  const children = childProjectFiles(allFiles, file._id)
  const open = expanded.has(file._id)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-overlay-file-id', file._id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(event) => {
          if (file.type !== 'folder') return
          if (!event.dataTransfer.types.includes('application/x-overlay-file-id')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          if (file.type !== 'folder') return
          event.preventDefault()
          setDragOver(false)
          const fileId = event.dataTransfer.getData('application/x-overlay-file-id')
          if (!fileId || fileId === file._id) return
          onMove(fileId, file._id)
        }}
        onClick={() => onOpen(file)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(file)
          }
        }}
        className={`${panelItemClass} cursor-pointer ${dragOver ? 'bg-[var(--surface-subtle)] ring-1 ring-inset ring-[var(--foreground)]' : activeFileId === file._id ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {file.type === 'folder' ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(file._id)
            }}
            className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            aria-label={open ? 'Collapse folder' : 'Expand folder'}
          >
            <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : null}
        {file.type === 'folder'
          ? open
            ? <FolderOpen size={12} className="shrink-0" />
            : <Folder size={12} className="shrink-0" />
          : file.kind === 'note'
            ? <BookOpen size={12} className="shrink-0 text-[var(--muted-light)]" />
            : <FileText size={12} className="shrink-0 text-[var(--muted-light)]" />}
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
      </div>

      {file.type === 'folder' && open && children.map((child) => (
        <FilesInlineBranch
          key={child._id}
          file={child}
          allFiles={allFiles}
          depth={depth + 1}
          expanded={expanded}
          activeFileId={activeFileId}
          onToggle={onToggle}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

export interface FilesInlineTreeProps {
  files: readonly ProjectFileSummary[]
  loading?: boolean
  loadingContent?: ReactNode
  emptyLabel?: ReactNode
  activeFileId: string | null
  expanded: ReadonlySet<string>
  onToggle: (fileId: string) => void
  onOpen: (file: ProjectFileSummary) => void
  onMove: (fileId: string, parentId: string | null) => void
}

export function FilesInlineTree({
  files,
  loading,
  loadingContent,
  emptyLabel = 'No files yet',
  activeFileId,
  expanded,
  onToggle,
  onOpen,
  onMove,
}: FilesInlineTreeProps) {
  const roots = rootProjectFiles(files)
  if (loading) return <>{loadingContent ?? <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">Loading...</p>}</>
  if (roots.length === 0) return <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">{emptyLabel}</p>
  return (
    <>
      {roots.map((file) => (
        <FilesInlineBranch
          key={file._id}
          file={file}
          allFiles={files}
          depth={0}
          expanded={expanded}
          activeFileId={activeFileId}
          onToggle={onToggle}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
    </>
  )
}

export interface ProjectInlineBranchProps {
  project: ProjectSummary
  allProjects: readonly ProjectSummary[]
  depth: number
  expanded: ReadonlySet<string>
  activeProjectId: string | null
  items: Record<string, ProjectResourceItems>
  itemsLoading: ReadonlySet<string>
  onToggle: (projectId: string) => void
  onOpenProject: (project: ProjectSummary) => void
  onNavigateItem: (project: ProjectSummary, view: ProjectRouteView, id: string) => void
  onDeleteProject: (projectId: string, event: MouseEvent) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, event: MouseEvent) => void
  onRenameProject: (project: ProjectSummary, name: string) => Promise<string | null | undefined> | string | null | undefined
}

export function ProjectInlineBranch({
  project,
  allProjects,
  depth,
  expanded,
  activeProjectId,
  items,
  itemsLoading,
  onToggle,
  onOpenProject,
  onNavigateItem,
  onDeleteProject,
  onDeleteItem,
  onRenameProject,
}: ProjectInlineBranchProps) {
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null)
  const [pendingDeleteItemKey, setPendingDeleteItemKey] = useState<string | null>(null)

  const children = allProjects.filter((candidate) => candidate.parentId === project._id)
  const open = expanded.has(project._id)
  const projectItems = items[project._id]
  const rootFiles = rootProjectFiles(projectItems?.files ?? [])

  async function commitProjectRowRename() {
    if (renamingProjectId !== project._id) return
    const name = renameDraft.trim()
    setRenamingProjectId(null)
    if (!name || name === project.name) return
    await onRenameProject(project, name)
  }

  function requestProjectDelete(event: MouseEvent) {
    event.stopPropagation()
    setRenamingProjectId(null)
    setPendingDeleteProjectId(project._id)
  }

  function requestProjectItemDelete(type: 'chat' | 'note', id: string, event: MouseEvent) {
    event.stopPropagation()
    setPendingDeleteItemKey(`${type}:${id}`)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onMouseLeave={() => {
          if (pendingDeleteProjectId === project._id) setPendingDeleteProjectId(null)
        }}
        onClick={() => {
          if (renamingProjectId === project._id) return
          onOpenProject(project)
        }}
        onKeyDown={(event) => {
          if (renamingProjectId === project._id) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpenProject(project)
          }
        }}
        className={`${panelItemClass} cursor-pointer ${activeProjectId === project._id ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggle(project._id)
          }}
          className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
          aria-label={open ? 'Collapse project' : 'Expand project'}
        >
          <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {open ? <FolderOpen size={12} className="shrink-0" /> : <Folder size={12} className="shrink-0" />}
        {renamingProjectId === project._id ? (
          <input
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-xs text-[var(--foreground)] outline-none"
            value={renameDraft}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void commitProjectRowRename()
              }
              if (event.key === 'Escape') {
                setRenamingProjectId(null)
                setRenameDraft('')
              }
            }}
            onBlur={() => void commitProjectRowRename()}
            autoFocus
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setPendingDeleteProjectId(null)
            setRenamingProjectId(project._id)
            setRenameDraft(project.name)
          }}
          className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
          aria-label="Rename project"
        >
          <Pencil size={11} />
        </button>
        {pendingDeleteProjectId === project._id ? (
          <button
            type="button"
            onClick={(event) => {
              setPendingDeleteProjectId(null)
              onDeleteProject(project._id, event)
            }}
            className={inlineConfirmDeleteButtonClass}
            aria-label="Confirm delete project"
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={requestProjectDelete}
            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
            aria-label="Delete project"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-0.5">
          {children.map((child) => (
            <ProjectInlineBranch
              key={child._id}
              project={child}
              allProjects={allProjects}
              depth={depth + 1}
              expanded={expanded}
              activeProjectId={activeProjectId}
              items={items}
              itemsLoading={itemsLoading}
              onToggle={onToggle}
              onOpenProject={onOpenProject}
              onNavigateItem={onNavigateItem}
              onDeleteProject={onDeleteProject}
              onDeleteItem={onDeleteItem}
              onRenameProject={onRenameProject}
            />
          ))}

          {itemsLoading.has(project._id) ? (
            <div className="space-y-1.5 py-1" style={{ paddingLeft: `${34 + depth * 14}px` }} aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 pr-2">
                  <div className="ui-skeleton-line h-2.5 w-2.5 shrink-0 rounded" />
                  <div
                    className="ui-skeleton-line h-2.5 max-w-[200px] flex-1 rounded"
                    style={{ width: `${78 - i * 6}%` }}
                  />
                </div>
              ))}
            </div>
          ) : projectItems ? (
            <>
              {projectItems.chats.map((chat) => (
                <div
                  key={chat._id}
                  onMouseLeave={() => {
                    if (pendingDeleteItemKey === `chat:${chat._id}`) setPendingDeleteItemKey(null)
                  }}
                  onClick={() => onNavigateItem(project, 'chat', chat._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <MessageSquare size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                  {pendingDeleteItemKey === `chat:${chat._id}` ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        setPendingDeleteItemKey(null)
                        onDeleteItem('chat', chat._id, event)
                      }}
                      className={inlineConfirmDeleteButtonClass}
                      aria-label="Confirm delete project chat"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => requestProjectItemDelete('chat', chat._id, event)}
                      className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                      aria-label="Delete project chat"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              ))}
              {projectItems.notes.map((note) => (
                <div
                  key={note._id}
                  onMouseLeave={() => {
                    if (pendingDeleteItemKey === `note:${note._id}`) setPendingDeleteItemKey(null)
                  }}
                  onClick={() => onNavigateItem(project, 'note', note._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <BookOpen size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
                  {pendingDeleteItemKey === `note:${note._id}` ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        setPendingDeleteItemKey(null)
                        onDeleteItem('note', note._id, event)
                      }}
                      className={inlineConfirmDeleteButtonClass}
                      aria-label="Confirm delete project note"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => requestProjectItemDelete('note', note._id, event)}
                      className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                      aria-label="Delete project note"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              ))}
              {rootFiles.map((file) => (
                <div
                  key={file._id}
                  onClick={() => onNavigateItem(project, projectRouteViewForFile(file), file._id)}
                  className={`${panelItemClass} cursor-pointer`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  <FileText size={11} className="shrink-0 text-[var(--muted-light)]" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export interface ProjectsInlineTreeProps {
  projects: readonly ProjectSummary[]
  rootProjects: readonly ProjectSummary[]
  loading?: boolean
  loadingContent?: ReactNode
  expanded: ReadonlySet<string>
  activeProjectId: string | null
  items: Record<string, ProjectResourceItems>
  itemsLoading: ReadonlySet<string>
  onToggle: (projectId: string) => void
  onOpenProject: (project: ProjectSummary) => void
  onNavigateItem: (project: ProjectSummary, view: ProjectRouteView, id: string) => void
  onDeleteProject: (projectId: string, event: MouseEvent) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, event: MouseEvent) => void
  onRenameProject: (project: ProjectSummary, name: string) => Promise<string | null | undefined> | string | null | undefined
}

export function ProjectsInlineTree({
  projects,
  rootProjects,
  loading,
  loadingContent,
  expanded,
  activeProjectId,
  items,
  itemsLoading,
  onToggle,
  onOpenProject,
  onNavigateItem,
  onDeleteProject,
  onDeleteItem,
  onRenameProject,
}: ProjectsInlineTreeProps) {
  if (loading) return <>{loadingContent ?? <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">Loading...</p>}</>
  if (rootProjects.length === 0) return <p className="px-2.5 py-2 text-xs text-[var(--muted-light)]">No projects yet</p>
  return (
    <>
      {rootProjects.map((project) => (
        <ProjectInlineBranch
          key={project._id}
          project={project}
          allProjects={projects}
          depth={0}
          expanded={expanded}
          activeProjectId={activeProjectId}
          items={items}
          itemsLoading={itemsLoading}
          onToggle={onToggle}
          onOpenProject={onOpenProject}
          onNavigateItem={onNavigateItem}
          onDeleteProject={onDeleteProject}
          onDeleteItem={onDeleteItem}
          onRenameProject={onRenameProject}
        />
      ))}
    </>
  )
}

export interface ProjectHubHeaderProps {
  projectId: string
  projectName: string
  editingName: boolean
  draftName: string
  savingName?: boolean
  actions?: ReactNode
  /** When provided, renders a gear button next to the project name that toggles the settings drawer. */
  settingsToggle?: {
    open: boolean
    onToggle: () => void
  }
  onStartRename: () => void
  onDraftNameChange: (value: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
}

export function ProjectHubHeader({
  projectId,
  projectName,
  editingName,
  draftName,
  savingName,
  actions,
  settingsToggle,
  onStartRename,
  onDraftNameChange,
  onCommitRename,
  onCancelRename,
}: ProjectHubHeaderProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:px-4 md:py-0">
      <ProjectAvatar projectId={projectId} name={projectName} size={16} />
      {editingName ? (
        <input
          className="min-w-0 flex-1 max-w-md rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
          value={draftName}
          disabled={savingName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onCommitRename()
            }
            if (event.key === 'Escape') {
              onCancelRename()
            }
          }}
          onBlur={onCommitRename}
          autoFocus
        />
      ) : (
        <div className="group/project-head flex min-w-0 items-center gap-1">
          <h1
            className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {projectName || 'Project'}
          </h1>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/project-head:opacity-100 focus-visible:opacity-100"
            aria-label="Rename project"
            onClick={onStartRename}
          >
            <Pencil size={13} />
          </button>
          {settingsToggle ? (
            <button
              type="button"
              className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/project-head:opacity-100 focus-visible:opacity-100 aria-pressed:text-[var(--foreground)] aria-pressed:opacity-100"
              aria-label="Project settings"
              aria-pressed={settingsToggle.open}
              onClick={settingsToggle.onToggle}
            >
              <Settings size={13} />
            </button>
          ) : null}
        </div>
      )}
      {actions}
    </div>
  )
}

export interface ProjectHubActionsProps {
  creatingOpen: boolean
  uploadOpen: boolean
  uploading?: boolean
  plusRef: RefObject<HTMLDivElement | null>
  uploadRef: RefObject<HTMLDivElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  folderInputRef: RefObject<HTMLInputElement | null>
  onToggleCreate: () => void
  onToggleUpload: () => void
  onCreateChat: () => void
  onCreateNote: () => void
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadFolder: (event: ChangeEvent<HTMLInputElement>) => void
}

export function ProjectHubActions({
  creatingOpen,
  uploadOpen,
  uploading,
  plusRef,
  uploadRef,
  fileInputRef,
  folderInputRef,
  onToggleCreate,
  onToggleUpload,
  onCreateChat,
  onCreateNote,
  onUploadFiles,
  onUploadFolder,
}: ProjectHubActionsProps) {
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <div ref={plusRef} className="relative">
        <button
          type="button"
          onClick={onToggleCreate}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          aria-label="Create"
        >
          <Plus size={14} />
          <ChevronDown size={11} className="opacity-60" />
        </button>
        {creatingOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
            <button
              type="button"
              onClick={onCreateChat}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <MessageSquare size={13} /> New chat
            </button>
            <button
              type="button"
              onClick={onCreateNote}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <BookOpen size={13} /> New file
            </button>
          </div>
        )}
      </div>
      <div ref={uploadRef} className="relative">
        <button
          type="button"
          onClick={onToggleUpload}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          aria-label="Upload"
          disabled={uploading}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <ChevronDown size={11} className="opacity-60" />
        </button>
        {uploadOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
            <button
              type="button"
              onClick={() => {
                onToggleUpload()
                fileInputRef.current?.click()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <FileText size={13} /> Upload file
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleUpload()
                folderInputRef.current?.click()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <FolderPlus size={13} /> Upload folder
            </button>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onUploadFiles}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error - non-standard attribute for folder uploads
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={onUploadFolder}
      />
    </div>
  )
}

export interface ProjectConnectedIntegration {
  slug: string
  name: string
  description?: string
  logoUrl?: string | null
}

export interface ProjectHubTabsProps {
  projectId: string
  activeTab: ProjectHubTab
  chats: readonly ProjectChatSummary[]
  files: readonly ProjectFileSummary[]
  listsLoading?: boolean
  instructions: string
  instructionsLoaded: boolean
  savingInstructions?: boolean
  instructionsSavedAt?: number | null
  connectedIntegrations: ReadonlyArray<ProjectConnectedIntegration>
  integrationsLoading: boolean
  lastIntegrationsError?: string | null
  onTabChange: (tab: ProjectHubTab) => void
  onOpenChat: (id: string) => void
  onOpenFile: (file: ProjectFileSummary) => void
  onInstructionsChange: (value: string) => void
}

export function ProjectHubTabs({
  projectId,
  activeTab,
  chats,
  files,
  listsLoading,
  instructions,
  instructionsLoaded,
  savingInstructions,
  instructionsSavedAt,
  connectedIntegrations,
  integrationsLoading,
  lastIntegrationsError,
  onTabChange,
  onOpenChat,
  onOpenFile,
  onInstructionsChange,
}: ProjectHubTabsProps) {
  const tabBtnClass = (active: boolean) =>
    `inline-flex items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
      active
        ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
    }`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onTabChange('chats')} className={tabBtnClass(activeTab === 'chats')}>
          Chats
        </button>
        <button type="button" onClick={() => onTabChange('files')} className={tabBtnClass(activeTab === 'files')}>
          Files
        </button>
        <button type="button" onClick={() => onTabChange('instructions')} className={tabBtnClass(activeTab === 'instructions')}>
          Instructions
        </button>
      </div>

      {activeTab === 'chats' && (
        <div>
          {listsLoading ? (
            <div className="flex justify-center py-6 text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /></div>
          ) : chats.length === 0 ? (
            <p className="px-1 py-2 text-xs text-[var(--muted)]">No chats yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {chats.map((chat) => (
                <li key={chat._id}>
                  <button
                    type="button"
                    onClick={() => onOpenChat(chat._id)}
                    className="flex w-full items-center gap-2 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
                  >
                    <MessageSquare size={13} className="shrink-0 text-[var(--muted-light)]" />
                    <span className="min-w-0 flex-1 truncate">{chat.title || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          {listsLoading ? (
            <div className="flex justify-center py-6 text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /></div>
          ) : files.length === 0 ? (
            <p className="px-1 py-2 text-xs text-[var(--muted)]">No files yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {files.map((file) => (
                <li key={file._id}>
                  <button
                    type="button"
                    onClick={() => onOpenFile(file)}
                    className="flex w-full items-center gap-2 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
                  >
                    {projectRouteViewForFile(file) === 'note' ? (
                      <BookOpen size={13} className="shrink-0 text-[var(--muted-light)]" />
                    ) : (
                      <FileText size={13} className="shrink-0 text-[var(--muted-light)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{file.name || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'instructions' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--muted)]">
            Set context and customize how Overlay responds in this project.
          </p>
          <textarea
            value={instructions}
            disabled={!instructionsLoaded}
            onChange={(event) => onInstructionsChange(event.target.value)}
            placeholder={instructionsLoaded ? 'Project instructions…' : 'Loading…'}
            rows={8}
            className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
          />
          <div className="flex h-4 items-center text-[11px] text-[var(--muted-light)]">
            {savingInstructions ? 'Saving…' : instructionsSavedAt ? 'Saved' : ''}
          </div>
          <ProjectIntegrationsSection
            projectId={projectId}
            connectedIntegrations={connectedIntegrations}
            integrationsLoading={integrationsLoading}
            lastIntegrationsError={lastIntegrationsError}
          />
        </div>
      )}
    </div>
  )
}

function ProjectIntegrationsSection({
  projectId,
  connectedIntegrations,
  integrationsLoading,
  lastIntegrationsError,
}: {
  projectId: string
  connectedIntegrations: ReadonlyArray<ProjectConnectedIntegration>
  integrationsLoading: boolean
  lastIntegrationsError?: string | null
}) {
  const integrationsHref = `/app/integrations?projectId=${encodeURIComponent(projectId)}`

  return (
    <section className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Integrations</h3>
        <a href={integrationsHref} className="text-xs text-[var(--foreground)] underline">
          {connectedIntegrations.length > 0 ? 'Manage' : 'Connect'}
        </a>
      </div>
      {lastIntegrationsError ? (
        <p className="text-xs text-red-500">{lastIntegrationsError}</p>
      ) : integrationsLoading ? (
        <div className="flex justify-center py-4 text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : connectedIntegrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Plug size={28} strokeWidth={1} className="text-[var(--muted-light)]" />
          <p className="mt-2 text-sm text-[var(--muted)]">No integrations connected to this project yet.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {connectedIntegrations.map((integration) => (
            <div key={integration.slug} className="flex items-center gap-3 py-2">
              {integration.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={integration.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md border border-[var(--border)] object-contain"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-xs font-medium text-[var(--muted)]">
                  {integration.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--foreground)]">{integration.name}</div>
                {integration.description ? (
                  <div className="hidden truncate text-xs text-[var(--muted-light)] sm:block">
                    {integration.description}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export interface ProjectsEmptyLandingProps {
  creating?: boolean
  onCreateProject: () => void
}

export function ProjectsEmptyLanding({ creating, onCreateProject }: ProjectsEmptyLandingProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:px-4 md:py-0">
        <h1
          className="text-lg font-medium text-[var(--foreground)]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Projects
        </h1>
        <button
          type="button"
          onClick={onCreateProject}
          disabled={creating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New project
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-[var(--muted)]">No projects yet.</p>
      </div>
    </div>
  )
}

export interface ProjectsSidebarFrameProps {
  selectedProject: ProjectSummary | null
  loading?: boolean
  itemsLoading?: boolean
  rootProjects: readonly ProjectSummary[]
  subprojects: readonly ProjectSummary[]
  projectChats: readonly ProjectChatSummary[]
  projectNotes: readonly ProjectNoteSummary[]
  rootProjectFiles: readonly ProjectFileSummary[]
  allProjectFiles: readonly ProjectFileSummary[]
  expandedProjectIds: ReadonlySet<string>
  expandedFileIds: ReadonlySet<string>
  showNewProject: boolean
  newProjectParentId: string | null
  newProjectName: string
  creatingProject?: boolean
  addMenuOpen: boolean
  addMenuRef: RefObject<HTMLDivElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  folderInputRef: RefObject<HTMLInputElement | null>
  projectUploadError?: string | null
  projectDraftName: string
  projectDraftInstructions: string
  savingProjectMeta?: boolean
  renderRootProject: (project: ProjectSummary) => ReactNode
  onBack: () => void
  onToggleAddMenu: () => void
  onOpenNewProjectForm: (parentId: string | null) => void
  onCancelNewProject: () => void
  onNewProjectNameChange: (value: string) => void
  onCreateProject: () => void
  onCreateChat: () => void
  onCreateNote: () => void
  onUploadFile: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadFolder: (event: ChangeEvent<HTMLInputElement>) => void
  onProjectDraftNameChange: (value: string) => void
  onProjectDraftInstructionsChange: (value: string) => void
  onSaveProjectMeta: () => void
  onOpenSubproject: (project: ProjectSummary) => void
  onDeleteProject: (projectId: string, event: MouseEvent) => void
  onOpenProjectChat: (id: string) => void
  onOpenProjectNote: (id: string) => void
  onDeleteItem: (type: 'chat' | 'note', id: string, event: MouseEvent) => void
  onToggleFileFolder: (id: string, event: MouseEvent) => void
  onOpenProjectFile: (id: string) => void
  onDeleteProjectFile: (id: string, event: MouseEvent) => void
}

export function ProjectsSidebarFrame({
  selectedProject,
  loading,
  itemsLoading,
  rootProjects,
  subprojects,
  projectChats,
  projectNotes,
  rootProjectFiles,
  allProjectFiles,
  expandedFileIds,
  showNewProject,
  newProjectParentId,
  newProjectName,
  creatingProject,
  addMenuOpen,
  addMenuRef,
  fileInputRef,
  folderInputRef,
  projectUploadError,
  projectDraftName,
  projectDraftInstructions,
  savingProjectMeta,
  renderRootProject,
  onBack,
  onToggleAddMenu,
  onOpenNewProjectForm,
  onCancelNewProject,
  onNewProjectNameChange,
  onCreateProject,
  onCreateChat,
  onCreateNote,
  onUploadFile,
  onUploadFolder,
  onProjectDraftNameChange,
  onProjectDraftInstructionsChange,
  onSaveProjectMeta,
  onOpenSubproject,
  onDeleteProject,
  onOpenProjectChat,
  onOpenProjectNote,
  onDeleteItem,
  onToggleFileFolder,
  onOpenProjectFile,
  onDeleteProjectFile,
}: ProjectsSidebarFrameProps) {
  function onNewProjectKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') onCreateProject()
    if (event.key === 'Escape') onCancelNewProject()
  }

  return (
    <div className="w-52 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onUploadFile} />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={onUploadFolder}
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
      />

      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-3 gap-2 shrink-0">
        {selectedProject ? (
          <>
            <button
              onClick={onBack}
              className="p-1 rounded hover:bg-[#e8e8e8] transition-colors shrink-0"
            >
              <ArrowLeft size={13} className="text-[#525252]" />
            </button>
            <span className="flex-1 text-sm font-medium text-[#0a0a0a] truncate">{selectedProject.name}</span>
            <div ref={addMenuRef} className="relative shrink-0">
              <button
                onClick={onToggleAddMenu}
                className="flex items-center justify-center w-6 h-6 rounded-md text-xs bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
              >
                <Plus size={13} />
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e5e5e5] rounded-lg shadow-lg py-1 z-50">
                  <button onClick={onCreateChat} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <MessageSquare size={12} />New Chat
                  </button>
                  <button onClick={onCreateNote} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <BookOpen size={12} />New Note
                  </button>
                  <button onClick={() => { onToggleAddMenu(); fileInputRef.current?.click() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <Upload size={12} />Upload File
                  </button>
                  <button onClick={() => { onToggleAddMenu(); folderInputRef.current?.click() }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                    <FolderPlus size={12} />Upload Folder
                  </button>
                  <div className="border-t border-[#f0f0f0] mt-1 pt-1">
                    <button onClick={() => onOpenNewProjectForm(selectedProject._id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#525252] hover:bg-[#f5f5f5] transition-colors">
                      <Folder size={12} />New Subproject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => onOpenNewProjectForm(null)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm bg-[#0a0a0a] text-[#fafafa] hover:bg-[#222] transition-colors"
          >
            <Plus size={13} />
            New Project
          </button>
        )}
      </div>

      {showNewProject && (
        <div className="px-3 py-2 border-b border-[#e5e5e5] bg-[#fafafa]">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#aaa] mb-1.5">
            {newProjectParentId ? 'New Subproject' : 'New Project'}
          </p>
          <input
            value={newProjectName}
            onChange={(event) => onNewProjectNameChange(event.target.value)}
            placeholder="Project name"
            autoFocus
            onKeyDown={onNewProjectKeyDown}
            className="w-full text-xs border border-[#e5e5e5] rounded-md px-2 py-1.5 outline-none placeholder-[#aaa] focus:border-[#0a0a0a] transition-colors bg-white"
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={onCancelNewProject}
              className="flex-1 py-1 rounded text-xs text-[#525252] hover:bg-[#e8e8e8] transition-colors"
            >Cancel</button>
            <button
              onClick={onCreateProject}
              disabled={!newProjectName.trim() || creatingProject}
              className="flex-1 py-1 rounded text-xs bg-[#0a0a0a] text-[#fafafa] disabled:opacity-40 hover:bg-[#222] transition-colors"
            >{creatingProject ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      )}

      {selectedProject && projectUploadError && (
        <div className="shrink-0 px-2 py-2 text-[10px] text-red-600 bg-red-50 border-b border-red-100 leading-snug">
          {projectUploadError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {loading ? (
          <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
        ) : selectedProject ? (
          itemsLoading ? (
            <div className="flex justify-center pt-8 text-[#888]"><Loader2 size={14} className="animate-spin" /></div>
          ) : (
            <div className="space-y-0.5">
              <div className="mx-1 mb-3 rounded-xl border border-[#e8e8e8] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#a1a1aa]">
                      Project
                    </p>
                    <input
                      value={projectDraftName}
                      onChange={(event) => onProjectDraftNameChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          onSaveProjectMeta()
                        }
                      }}
                      className="mt-1 w-full bg-transparent text-sm font-medium text-[#0a0a0a] outline-none placeholder-[#bbb]"
                      placeholder="Project name"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onSaveProjectMeta}
                    disabled={savingProjectMeta || !projectDraftName.trim()}
                    className="shrink-0 rounded-md bg-[#0a0a0a] px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-[#222] disabled:opacity-40"
                  >
                    {savingProjectMeta ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#a1a1aa]">
                    Instructions
                  </p>
                  <textarea
                    value={projectDraftInstructions}
                    onChange={(event) => onProjectDraftInstructionsChange(event.target.value)}
                    className="min-h-[92px] w-full resize-y rounded-lg border border-[#ececec] bg-[#fafafa] px-2.5 py-2 text-xs text-[#303030] outline-none transition-colors placeholder-[#b2b2b2] focus:border-[#0a0a0a]"
                    placeholder="Guidance that should apply to chats and notes in this project."
                  />
                </div>
              </div>

              {subprojects.map((subproject) => (
                <div
                  key={subproject._id}
                  onClick={() => onOpenSubproject(subproject)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors"
                >
                  <div className={PROJECT_TREE_CHEVRON_COL} aria-hidden />
                  <div className={PROJECT_TREE_ICON_COL}>
                    <Folder size={12} />
                  </div>
                  <span className="flex-1 truncate">{subproject.name}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteProject(subproject._id, event)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {projectChats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => onOpenProjectChat(chat._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <div className={PROJECT_TREE_CHEVRON_COL} aria-hidden />
                  <div className={PROJECT_TREE_ICON_COL}>
                    <MessageSquare size={12} />
                  </div>
                  <span className="flex-1 truncate">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteItem('chat', chat._id, event)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {projectNotes.map((note) => (
                <div
                  key={note._id}
                  onClick={() => onOpenProjectNote(note._id)}
                  className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-[#525252] hover:bg-[#ebebeb] hover:text-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <div className={PROJECT_TREE_CHEVRON_COL} aria-hidden />
                  <div className={PROJECT_TREE_ICON_COL}>
                    <BookOpen size={12} />
                  </div>
                  <span className="flex-1 truncate">{note.title || 'Untitled'}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteItem('note', note._id, event)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {rootProjectFiles.map((file) => (
                <ProjectFileTreeNode
                  key={file._id}
                  file={file}
                  allFiles={allProjectFiles}
                  depth={0}
                  baseIndentPx={PROJECT_TREE_GUTTER_PX}
                  expandedIds={expandedFileIds}
                  onToggleFolder={onToggleFileFolder}
                  onOpenFile={onOpenProjectFile}
                  onDeleteFile={onDeleteProjectFile}
                />
              ))}
              {subprojects.length === 0 && projectChats.length === 0 && projectNotes.length === 0 && allProjectFiles.length === 0 && (
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
              {rootProjects.map((project) => renderRootProject(project))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
