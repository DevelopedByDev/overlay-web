'use client'

import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { FolderOpen } from 'lucide-react'
import type React from 'react'
import HeaderToolbar from './HeaderToolbar'
import BubbleToolbar from './BubbleToolbar'
import PageHeader from './PageHeader'
import AIPopover from './AIPopover'

type NoteMeta = {
  icon?: string
  coverImage?: string
  coverPosition?: number
}

export default function EditorShell({
  editor,
  title,
  isDirty,
  projectName,
  noteMeta,
  aiOpen,
  onAiOpen,
  onAiClose,
  onTitleChange,
  onIconChange,
  onCoverChange,
  onCoverRemove,
}: {
  editor: Editor | null
  title: string
  isDirty: boolean
  projectName?: string
  noteMeta: NoteMeta
  aiOpen: boolean
  onAiOpen: () => void
  onAiClose: () => void
  onTitleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onIconChange: (icon: string | undefined) => void
  onCoverChange: (file: File) => void
  onCoverRemove: () => void
}) {
  return (
    <>
      <PageHeader
        icon={noteMeta.icon}
        coverImage={noteMeta.coverImage}
        coverPosition={noteMeta.coverPosition}
        onIconChange={onIconChange}
        onCoverChange={onCoverChange}
        onCoverRemove={onCoverRemove}
      />
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6">
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="Note title..."
          className="flex-1 bg-transparent font-medium text-xl text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          style={{ fontFamily: 'var(--font-serif)' }}
        />
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {projectName && (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
              <FolderOpen size={9} />
              {projectName}
            </span>
          )}
          {isDirty && <span className="text-[11px] text-[var(--muted-light)]">Unsaved</span>}
        </div>
      </div>
      <HeaderToolbar editor={editor} onImprove={onAiOpen} />
      <div className="relative flex-1 overflow-y-auto px-6 py-4">
        <BubbleToolbar editor={editor} onImprove={onAiOpen} />
        <EditorContent editor={editor} />
        <AIPopover editor={editor} open={aiOpen} onClose={onAiClose} />
      </div>
    </>
  )
}
