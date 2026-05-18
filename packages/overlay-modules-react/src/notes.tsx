'use client'

import { useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  ChevronLeft,
  ChevronRight,
  Code,
  FolderOpen,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
} from 'lucide-react'
import type { NoteDoc, NotebookAgentUiItem, NotebookNote } from '@overlay/app-core'
import { Button, EmptyState, Input, Textarea, cn } from '@overlay/ui'

export interface NotesEditorShellProps {
  notes: readonly NoteDoc[]
  selectedNoteId?: string | null
  title: string
  content: string
  dirty?: boolean
  saving?: boolean
  loading?: boolean
  sidebarActions?: ReactNode
  editorActions?: ReactNode
  agentPanel?: ReactNode
  onSelectNote?: (note: NoteDoc) => void
  onCreateNote?: () => void
  onDeleteNote?: (note: NoteDoc) => void
  onTitleChange?: (title: string) => void
  onContentChange?: (content: string) => void
  onSave?: () => void
}

export function NotesEditorShell({
  notes,
  selectedNoteId,
  title,
  content,
  dirty,
  saving,
  loading,
  sidebarActions,
  editorActions,
  agentPanel,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onTitleChange,
  onContentChange,
  onSave,
}: NotesEditorShellProps) {
  const selectedNote = notes.find((note) => note._id === selectedNoteId) ?? null

  return (
    <section className="flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
          <h1 className="text-sm font-semibold">Notes</h1>
          <div className="flex items-center gap-1">
            {sidebarActions}
            {onCreateNote ? (
              <Button size="sm" variant="ghost" onClick={onCreateNote}>
                New
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-2">
          {loading ? (
            <div className="px-3 py-2 text-xs text-[var(--muted)]">Loading notes...</div>
          ) : notes.length === 0 ? (
            <EmptyState className="h-full px-4" title="No notes yet" />
          ) : (
            notes.map((note) => (
              <button
                key={note._id}
                type="button"
                onClick={() => onSelectNote?.(note)}
                className={cn(
                  'group/row flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                  selectedNoteId === note._id
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{note.title || 'Untitled'}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted-light)]">
                    {note.content || 'Empty note'}
                  </span>
                </span>
                {onDeleteNote ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteNote(note)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        onDeleteNote(note)
                      }
                    }}
                    className="hidden rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--border)] group-hover/row:inline-flex"
                  >
                    Delete
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
          <Input
            value={title}
            disabled={!selectedNote}
            onChange={(event) => onTitleChange?.(event.target.value)}
            className="border-transparent bg-transparent px-0 text-base font-semibold focus:ring-0"
            placeholder="Untitled"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {dirty ? <span className="text-xs text-[var(--muted)]">Unsaved</span> : null}
            {editorActions}
            {onSave ? (
              <Button size="sm" disabled={!dirty || saving || !selectedNote} onClick={onSave}>
                {saving ? 'Saving' : 'Save'}
              </Button>
            ) : null}
          </div>
        </div>
        {selectedNote ? (
          <Textarea
            value={content}
            onChange={(event) => onContentChange?.(event.target.value)}
            className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-6 py-5 text-sm leading-7 focus:ring-0"
            placeholder="Start writing..."
          />
        ) : (
          <EmptyState className="h-full" title="Select a note" />
        )}
      </main>

      {agentPanel ? (
        <aside className="hidden w-80 shrink-0 border-l border-[var(--border)] bg-[var(--surface-elevated)] lg:block">
          {agentPanel}
        </aside>
      ) : null}
    </section>
  )
}

export interface NotebookHeaderProps {
  activeNote: NotebookNote | null
  title: string
  projectName?: string
  isDirty?: boolean
  agentPanelOpen?: boolean
  exportMenu?: ReactNode
  assistantHeader?: ReactNode
  onBackToFiles: () => void
  onCreateNote: () => void
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void
  onTitleBlur: () => void
  onTitleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onToggleAgentPanel: () => void
}

export function NotebookHeader({
  activeNote,
  title,
  projectName,
  isDirty,
  agentPanelOpen,
  exportMenu,
  assistantHeader,
  onBackToFiles,
  onCreateNote,
  onTitleChange,
  onTitleBlur,
  onTitleKeyDown,
  onToggleAgentPanel,
}: NotebookHeaderProps) {
  if (!activeNote) {
    return (
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
        <div className="shrink-0">
          <h2 className="text-sm font-medium text-[var(--foreground)]">Notes</h2>
        </div>
        <div className="flex-1" />
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Plus size={14} />
          New note
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-16 shrink-0 border-b border-[var(--border)]">
      <div className="flex flex-1 items-center justify-between gap-3 px-6">
        <button
          type="button"
          onClick={onBackToFiles}
          title="Back to files"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={17} />
        </button>
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          onBlur={onTitleBlur}
          onKeyDown={onTitleKeyDown}
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
          {exportMenu}
          <button
            type="button"
            onClick={onToggleAgentPanel}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
              agentPanelOpen ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
            }`}
            aria-label={agentPanelOpen ? 'Close note assistant' : 'Open note assistant'}
            title="Note assistant"
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </div>
      {agentPanelOpen ? assistantHeader : null}
    </div>
  )
}

export interface NotebookAgentHeaderProps {
  pendingDiffCount: number
  modelPicker: ReactNode
  onAcceptAllDiffs: () => void
  onRejectAllDiffs: () => void
}

export function NotebookAgentHeader({
  pendingDiffCount,
  modelPicker,
  onAcceptAllDiffs,
  onRejectAllDiffs,
}: NotebookAgentHeaderProps) {
  return (
    <div className="flex w-[min(400px,92vw)] shrink-0 items-center justify-between gap-3 border-l border-[var(--border)] px-4">
      <span className="text-xs font-medium text-[var(--foreground)]">Assistant</span>
      <div className="flex items-center gap-2">
        {pendingDiffCount > 0 && (
          <>
            <button
              type="button"
              onClick={onAcceptAllDiffs}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={onRejectAllDiffs}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              Reject all
            </button>
          </>
        )}
        {modelPicker}
      </div>
    </div>
  )
}

export interface NotebookNotesSidebarProps {
  notes: readonly NotebookNote[]
  activeNoteId?: string | null
  onCreateNote: () => void
  onOpenNote: (note: NotebookNote) => void
  onDeleteNote: (noteId: string, event: MouseEvent) => void
}

export function NotebookNotesSidebar({
  notes,
  activeNoteId,
  onCreateNote,
  onOpenNote,
  onDeleteNote,
}: NotebookNotesSidebarProps) {
  return (
    <div className="w-52 h-full flex flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
      <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
        <button
          onClick={onCreateNote}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Plus size={13} />
          New note
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {notes.map((note) => (
          <div
            key={note._id}
            onClick={() => onOpenNote(note)}
            className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
              activeNoteId === note._id
                ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <span className="text-xs truncate">{note.title || 'Untitled'}</span>
            <button
              onClick={(event) => onDeleteNote(note._id, event)}
              className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface NotebookEmptyStateProps {
  onCreateNote: () => void
}

export function NotebookEmptyState({ onCreateNote }: NotebookEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="mb-2 text-3xl text-[var(--foreground)]" style={{ fontFamily: 'var(--font-serif)' }}>
          notes
        </p>
        <p className="text-sm text-[var(--muted)] mb-4">Select a note or create a new one</p>
        <button
          onClick={onCreateNote}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Plus size={14} />
          New Note
        </button>
      </div>
    </div>
  )
}

export interface NotebookAgentPanelProps {
  items: readonly NotebookAgentUiItem[]
  running?: boolean
  logo?: ReactNode
  composer: ReactNode
  renderMarkdownMessage: (text: string, isStreaming: boolean) => ReactNode
}

export function NotebookAgentPanel({
  items,
  running,
  logo,
  composer,
  renderMarkdownMessage,
}: NotebookAgentPanelProps) {
  return (
    <aside
      className="flex w-[min(400px,92vw)] shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]"
      aria-label="Note assistant"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        {items.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--muted)]">Ask about this note or describe edits...</p>
          </div>
        )}
        {items.map((item, idx) => {
          if (item.type === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="chat-user-bubble min-w-0 max-w-[min(92%,36rem)] break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:max-w-[75%]">
                  <span className="whitespace-pre-wrap">{item.text}</span>
                </div>
              </div>
            )
          }
          if (item.type === 'thinking') {
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span
                  className="overlay-stream-marker overlay-stream-marker--standalone h-4 w-4"
                  aria-label={item.text}
                  role="img"
                />
              </div>
            )
          }
          if (item.type === 'tool_call') {
            const toolLabel = item.tool === 'search_knowledge' ? 'Searching knowledge' :
              item.tool === 'read_note' ? 'Reading note' :
              item.tool === 'propose_edit' ? 'Proposing edit' :
              item.tool === 'finish' ? 'Done' : item.tool
            const isRunning = running && idx === items.length - 1
            return (
              <div key={idx} className="flex w-full max-w-[min(100%,36rem)] items-stretch gap-2.5 py-1 text-[13px] leading-snug">
                <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <div className="relative z-[1] shrink-0 rounded-full bg-[var(--background)] p-px">
                    {logo}
                  </div>
                </div>
                <span className={isRunning ? 'tool-line-shimmer' : 'text-[var(--tool-line-label)]'}>
                  {toolLabel}
                </span>
              </div>
            )
          }
          if (item.type === 'text') {
            return (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {renderMarkdownMessage(item.text ?? '', Boolean(running && idx === items.length - 1))}
                </div>
              </div>
            )
          }
          return (
            <div key={idx} className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">
              {item.text}
            </div>
          )
        })}
      </div>
      <div className="shrink-0 p-3">{composer}</div>
    </aside>
  )
}

export interface NotebookAgentComposerProps {
  input: ReactNode
  running?: boolean
  canSend?: boolean
  onSend: () => void
  onStop: () => void
}

export function NotebookAgentComposer({
  input,
  running,
  canSend,
  onSend,
  onStop,
}: NotebookAgentComposerProps) {
  return (
    <div className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="p-2.5">
        {input}
        <div className="mt-2 flex min-h-9 items-center justify-end gap-2">
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80"
              aria-label="Stop"
            >
              <div className="h-3.5 w-3.5 rounded-sm bg-[var(--background)]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80 disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export interface NotebookFormatCommandChain {
  focus: (position?: 'start') => NotebookFormatCommandChain
  toggleHeading: (attributes: { level: 1 | 2 }) => { run: () => boolean }
  toggleBold: () => { run: () => boolean }
  toggleItalic: () => { run: () => boolean }
  toggleUnderline: () => { run: () => boolean }
  toggleStrike: () => { run: () => boolean }
  toggleCode: () => { run: () => boolean }
  toggleHighlight: () => { run: () => boolean }
  toggleBulletList: () => { run: () => boolean }
  toggleOrderedList: () => { run: () => boolean }
  toggleTaskList: () => { run: () => boolean }
  setTextAlign: (align: 'left' | 'center' | 'right') => { run: () => boolean }
}

export interface NotebookFormatEditor {
  chain: () => NotebookFormatCommandChain
  isActive: (nameOrAttributes: string | Record<string, string>, attributes?: Record<string, unknown>) => boolean
}

export interface NotebookFloatingFormatToolbarProps {
  editor: NotebookFormatEditor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const floatingToolbarButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40'

const floatingToolbarActiveButtonClass =
  'bg-[var(--surface-subtle)] text-[var(--foreground)]'

const floatingToolbarDividerClass = 'mx-1 h-5 w-px shrink-0 bg-[var(--border)]'

export function NotebookFloatingFormatToolbar({
  editor,
  open,
  onOpenChange,
}: NotebookFloatingFormatToolbarProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="absolute bottom-5 right-5 z-30 flex max-w-[calc(100%-2.5rem)] items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-lg">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        aria-label={open ? 'Close formatting toolbar' : 'Open formatting toolbar'}
        aria-expanded={open}
        title={open ? 'Close formatting toolbar' : 'Formatting'}
      >
        {open ? (
          <ChevronRight size={16} />
        ) : hovered ? (
          <ChevronLeft size={16} />
        ) : (
          <Pencil size={16} />
        )}
      </button>

      {open && (
        <>
          <div className={floatingToolbarDividerClass} />
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('heading', { level: 1 }) ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Heading 1"
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('heading', { level: 2 }) ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Heading 2"
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <div className={floatingToolbarDividerClass} />
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('bold') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Bold"
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('italic') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Italic"
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('underline') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Underline"
            title="Underline"
          >
            <UnderlineIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('strike') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Strikethrough"
            title="Strikethrough"
          >
            <Strikethrough size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleCode().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('code') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Inline code"
            title="Inline code"
          >
            <Code size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('highlight') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Highlight"
            title="Highlight"
          >
            <Highlighter size={15} />
          </button>
          <div className={floatingToolbarDividerClass} />
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('bulletList') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Bullet list"
            title="Bullet list"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('orderedList') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Numbered list"
            title="Numbered list"
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive('taskList') ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Task list"
            title="Task list"
          >
            <ListTodo size={15} />
          </button>
          <div className={floatingToolbarDividerClass} />
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive({ textAlign: 'left' }) ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Align left"
            title="Align left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive({ textAlign: 'center' }) ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Align center"
            title="Align center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            className={`${floatingToolbarButtonClass} ${
              editor?.isActive({ textAlign: 'right' }) ? floatingToolbarActiveButtonClass : ''
            }`}
            aria-label="Align right"
            title="Align right"
          >
            <AlignRight size={15} />
          </button>
        </>
      )}
    </div>
  )
}
