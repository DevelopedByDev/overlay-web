'use client'

import type { Editor } from '@tiptap/react'

export default function BlockContextMenu({
  editor,
  open,
  x,
  y,
  onClose,
}: {
  editor: Editor | null
  open: boolean
  x: number
  y: number
  onClose: () => void
}) {
  if (!open || !editor) return null
  const itemClass = 'block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
  return (
    <div className="fixed z-50 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-lg" style={{ left: x, top: y }}>
      <button type="button" className={itemClass} onClick={() => { editor.chain().focus().liftListItem('listItem').run(); onClose() }}>Move up</button>
      <button type="button" className={itemClass} onClick={() => { editor.chain().focus().sinkListItem('listItem').run(); onClose() }}>Move down</button>
      <button type="button" className={itemClass} onClick={() => { editor.chain().focus().setParagraph().run(); onClose() }}>Turn into paragraph</button>
      <button type="button" className={itemClass} onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); onClose() }}>Turn into heading</button>
      <button type="button" className={itemClass} onClick={() => { editor.chain().focus().deleteSelection().run(); onClose() }}>Delete</button>
    </div>
  )
}
