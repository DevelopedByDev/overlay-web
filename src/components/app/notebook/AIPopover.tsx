'use client'

import type { Editor } from '@tiptap/react'
import { useState } from 'react'

const actions = ['Improve writing', 'Make shorter', 'Make longer', 'Continue writing', 'Summarize', 'Translate']

export default function AIPopover({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null
  open: boolean
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  if (!open || !editor) return null
  const activeEditor = editor

  async function runAi(instruction: string) {
    const selected = activeEditor.state.doc.textBetween(activeEditor.state.selection.from, activeEditor.state.selection.to, '\n')
    setLoading(true)
    setPreview('')
    try {
      const res = await fetch('/api/app/notes/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, selection: selected, document: activeEditor.getText() }),
      })
      if (!res.ok) throw new Error('AI request failed')
      const data = await res.json() as { html?: string; text?: string }
      setPreview(data.html ?? data.text ?? '')
    } catch {
      setPreview('AI assistance is not available for this note yet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute right-8 top-32 z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-xl">
      <div className="grid grid-cols-2 gap-1">
        {actions.map((action) => (
          <button key={action} type="button" onClick={() => void runAi(action)} className="rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            {action}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Custom prompt" className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs outline-none" />
        <button type="button" onClick={() => void runAi(prompt || 'Improve writing')} className="rounded-md bg-[var(--foreground)] px-2 py-1.5 text-xs text-[var(--background)]">Run</button>
      </div>
      {loading ? <p className="mt-3 text-xs text-[var(--muted-light)]">Generating...</p> : null}
      {preview ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
          <div className="max-h-40 overflow-y-auto text-xs text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: preview }} />
          <div className="mt-2 flex justify-end gap-1">
            <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)]">Discard</button>
            <button type="button" onClick={() => { activeEditor.chain().focus().deleteSelection().insertContent(preview).run(); onClose() }} className="rounded-md bg-[var(--foreground)] px-2 py-1 text-xs text-[var(--background)]">Accept</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
