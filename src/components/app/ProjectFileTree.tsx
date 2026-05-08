'use client'

import { ChevronRight, FolderOpen, Folder, FileText, Trash2 } from 'lucide-react'

/** Align chevron column + icon column across folders, chats, notes, and files */
export const TREE_GUTTER_PX = 8
export const TREE_DEPTH_STEP_PX = 16
export const TREE_CHEVRON_COL = 'w-[22px] shrink-0 flex items-center justify-center'
export const TREE_ICON_COL = 'w-[14px] shrink-0 flex items-center justify-center text-[#888]'

export interface Project {
  _id: string
  name: string
  instructions?: string
  parentId: string | null
  createdAt: number
  updatedAt: number
}

export interface ProjectChat { _id: string; title: string; lastModified: number }
export interface ProjectNote { _id: string; title: string; updatedAt: number }
export interface ProjectFile {
  _id: string
  name: string
  type: 'file' | 'folder'
  kind?: 'folder' | 'note' | 'upload' | 'output'
  mimeType?: string
  extension?: string
  parentId: string | null
}

export function opensInDocumentEditor(file: ProjectFile): boolean {
  if (file.kind === 'note') return true
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase()
  const mime = (file.mimeType || '').toLowerCase()
  return ext === 'md' || ext === 'markdown' || ext === 'txt' || mime === 'text/markdown' || mime.startsWith('text/')
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
}: {
  file: ProjectFile
  allFiles: ProjectFile[]
  depth: number
  baseIndentPx: number
  legacyInline?: boolean
  expandedIds: Set<string>
  onToggleFolder: (id: string, e: React.MouseEvent) => void
  onOpenFile: (id: string) => void
  onDeleteFile: (id: string, e: React.MouseEvent) => void
}) {
  const children = allFiles.filter((f) => f.parentId === file._id).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const isFolder = file.type === 'folder'
  const open = expandedIds.has(file._id)
  const rowPadLeft = legacyInline
    ? baseIndentPx + depth * 12
    : baseIndentPx + depth * TREE_DEPTH_STEP_PX

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isFolder) onToggleFolder(file._id, e as unknown as React.MouseEvent)
            else onOpenFile(file._id)
          }
        }}
        className={`group flex items-center gap-1.5 py-1.5 rounded-md text-xs text-[#525252] transition-colors ${
          file.type === 'file' ? 'cursor-pointer hover:bg-[#ebebeb] hover:text-[#0a0a0a]' : 'cursor-pointer hover:bg-[#ebebeb] hover:text-[#0a0a0a]'
        }`}
        style={{ paddingLeft: `${rowPadLeft}px`, paddingRight: '8px' }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          if (isFolder) onToggleFolder(file._id, e)
          else onOpenFile(file._id)
        }}
      >
        {legacyInline ? (
          isFolder ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFolder(file._id, e)
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
              onClick={(e) => {
                e.stopPropagation()
                onToggleFolder(file._id, e)
              }}
              className={`${TREE_CHEVRON_COL} p-0.5 rounded hover:bg-[#d8d8d8] transition-colors`}
            >
              <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            <div className={TREE_ICON_COL}>
              {open ? <FolderOpen size={12} /> : <Folder size={12} />}
            </div>
          </>
        ) : (
          <>
            <div className={TREE_CHEVRON_COL} aria-hidden />
            <div className={TREE_ICON_COL}>
              <FileText size={12} />
            </div>
          </>
        )}
        <span className="flex-1 truncate">{file.name}</span>
        <button
          type="button"
          onClick={(e) => onDeleteFile(file._id, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#d8d8d8] transition-opacity shrink-0"
        >
          <Trash2 size={10} />
        </button>
      </div>
      {isFolder && open && children.map((ch) => (
        <ProjectFileTreeNode
          key={ch._id}
          file={ch}
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
