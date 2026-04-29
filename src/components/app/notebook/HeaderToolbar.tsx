'use client'

import type { Editor } from '@tiptap/react'
import { ChevronDown, Eraser, MoreHorizontal, SmilePlus } from 'lucide-react'
import { useState } from 'react'
import {
  alignActions,
  ImproveButton,
  linkAction,
  markActions,
  moreActions,
  textStyleActions,
  ToolbarButton,
} from './toolbarButtons'

export default function HeaderToolbar({
  editor,
  onImprove,
}: {
  editor: Editor | null
  onImprove: () => void
}) {
  const [styleOpen, setStyleOpen] = useState(false)
  const [alignOpen, setAlignOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  if (!editor) return null

  const activeStyle = textStyleActions.find((action) => action.active?.(editor)) ?? textStyleActions[0]
  const activeAlign = alignActions.find((action) => action.active?.(editor)) ?? alignActions[0]

  return (
    <div className="relative flex h-12 shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 shadow-sm">
        <ImproveButton onClick={onImprove} />
        <div className="mx-1 h-5 w-px bg-[var(--border)]" />
        <div className="relative">
          <button type="button" onClick={() => setStyleOpen((v) => !v)} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            {activeStyle.icon}
            <ChevronDown size={12} />
          </button>
          {styleOpen ? (
            <div className="absolute left-0 top-8 z-50 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg">
              {textStyleActions.map((action) => (
                <button key={action.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { action.run(editor); setStyleOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {markActions.map((action) => <ToolbarButton key={action.id} editor={editor} action={action} />)}
        <ToolbarButton editor={editor} action={linkAction} />
        <div className="relative">
          <button type="button" onClick={() => setAlignOpen((v) => !v)} className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            {activeAlign.icon}
          </button>
          {alignOpen ? (
            <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg">
              {alignActions.map((action) => (
                <button key={action.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { action.run(editor); setAlignOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" title="Emoji" onClick={() => editor.chain().focus().insertContent('🙂').run()} className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
          <SmilePlus size={14} />
        </button>
        <div className="relative">
          <button type="button" onClick={() => setMoreOpen((v) => !v)} className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <MoreHorizontal size={14} />
          </button>
          {moreOpen ? (
            <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg">
              {moreActions.map((action) => (
                <button key={action.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { action.run(editor); setMoreOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
                  {action.icon}
                  {action.label}
                </button>
              ))}
              <button type="button" onClick={() => { editor.chain().focus().unsetAllMarks().clearNodes().run(); setMoreOpen(false) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
                <Eraser size={14} />
                Clear formatting
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
