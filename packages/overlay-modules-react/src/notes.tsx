'use client'

import type { ReactNode } from 'react'
import type { NoteDoc } from '@overlay/app-core'
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
