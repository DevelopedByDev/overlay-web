'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Sparkles, Trash2, Loader2, Check, ToggleLeft, ToggleRight, X, Pencil } from 'lucide-react'

interface Skill {
  _id: string
  name: string
  description: string
  instructions: string
  enabled?: boolean
  createdAt: number
  updatedAt: number
}

interface DialogState {
  mode: 'create' | 'edit'
  skill?: Skill
}

function SkillDialog({
  state,
  onClose,
  onSaved,
  onDeleted,
}: {
  state: DialogState
  onClose: () => void
  onSaved: (skill: Skill) => void
  onDeleted: (id: string) => void
}) {
  const isEdit = state.mode === 'edit'
  const initial = state.skill

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled !== false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      if (isEdit && initial) {
        const res = await fetch('/api/app/skills', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: initial._id, name, description, instructions, enabled }),
        })
        if (!res.ok) return
        onSaved({ ...initial, name, description, instructions, enabled })
        setSaved(true)
        setTimeout(() => { setSaved(false); onClose() }, 800)
      } else {
        const res = await fetch('/api/app/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || 'New Skill', description, instructions }),
        })
        if (!res.ok) return
        const { id } = await res.json() as { id: string }
        const newSkill: Skill = {
          _id: id,
          name: name || 'New Skill',
          description,
          instructions,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        onSaved(newSkill)
        setSaved(true)
        setTimeout(() => { setSaved(false); onClose() }, 800)
      }
      window.dispatchEvent(new CustomEvent('overlay:skills-changed'))
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!isEdit || !initial || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/app/skills?skillId=${initial._id}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('overlay:skills-changed'))
        onDeleted(initial._id)
        onClose()
      }
    } finally { setDeleting(false) }
  }

  function handleToggleEnabled() {
    setEnabled((v) => !v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* Dialog header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            {isEdit ? 'Edit Skill' : 'New Skill'}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <X size={16} />
          </button>
        </div>

        {/* Dialog body */}
        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Concise Responder"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this skill does"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-light)]">Instructions</label>
              <span className="text-[10px] text-[var(--muted-light)]">Markdown supported</span>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={'Describe what the AI should do differently when this skill is active.\n\nExample:\n- Always respond in bullet points\n- Keep answers under 3 sentences\n- Use a formal tone'}
              rows={12}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--muted)] focus:bg-[var(--surface-elevated)]"
            />
          </div>
        </div>

        {/* Dialog footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleToggleEnabled} className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
              {enabled
                ? <ToggleRight size={18} className="text-[var(--foreground)]" />
                : <ToggleLeft size={18} className="text-[var(--muted-light)]" />}
              <span>{enabled ? 'Active' : 'Disabled'}</span>
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-red-400 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SkillsView({ userId: _userId }: { userId: string; selectedSkillId?: string }) {
  void _userId

  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const loadSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/app/skills')
      if (res.ok) setSkills(await res.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadSkills() }, [loadSkills])

  function handleSaved(skill: Skill) {
    setSkills((prev) => {
      const idx = prev.findIndex((s) => s._id === skill._id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = skill
        return next
      }
      return [skill, ...prev]
    })
  }

  async function handleQuickToggle(skill: Skill, e: React.MouseEvent) {
    e.stopPropagation()
    const newEnabled = skill.enabled === false
    setSkills((prev) => prev.map((s) => s._id === skill._id ? { ...s, enabled: newEnabled } : s))
    try {
      await fetch('/api/app/skills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill._id, enabled: newEnabled }),
      })
      window.dispatchEvent(new CustomEvent('overlay:skills-changed'))
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
        <div>
          <h2 className="text-sm font-medium text-[var(--foreground)]">Skills</h2>
          <p className="text-[11px] text-[var(--muted)]">Reusable instructions injected into every AI response</p>
        </div>
        <button
          onClick={() => setDialog({ mode: 'create' })}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
        >
          <Plus size={12} />
          New Skill
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Sparkles size={40} strokeWidth={1} className="text-[var(--muted-light)]" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No skills yet</p>
            <p className="text-xs text-[var(--muted-light)]">Create reusable instructions that are automatically injected into every conversation</p>
          </div>
          <button
            onClick={() => setDialog({ mode: 'create' })}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            <Plus size={14} />
            New Skill
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => (
                <div
                  key={skill._id}
                  onClick={() => setDialog({ mode: 'edit', skill })}
                  className="group relative cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 transition-all hover:bg-[var(--surface-muted)] hover:shadow-sm"
                >
                  {/* Active dot */}
                  <span
                    className={`absolute right-4 top-4 h-2 w-2 rounded-full transition-colors ${skill.enabled !== false ? 'bg-[var(--foreground)]' : 'bg-[var(--muted-light)]'}`}
                    title={skill.enabled !== false ? 'Active' : 'Disabled'}
                  />

                  <div className="mb-3 flex items-start gap-2 pr-6">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)]">
                      <Sparkles size={13} className="text-[var(--muted)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{skill.name || 'Untitled'}</p>
                      {skill.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--muted)]">{skill.description}</p>
                      )}
                    </div>
                  </div>

                  {skill.instructions && (
                    <p className="line-clamp-2 font-mono text-[10px] text-[var(--muted-light)]">{skill.instructions}</p>
                  )}

                  {/* Hover actions */}
                  <div className="absolute bottom-3 right-3 hidden items-center gap-1 group-hover:flex">
                    <button
                      type="button"
                      onClick={(e) => void handleQuickToggle(skill, e)}
                      className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                      title={skill.enabled !== false ? 'Disable' : 'Enable'}
                    >
                      {skill.enabled !== false
                        ? <ToggleRight size={14} />
                        : <ToggleLeft size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDialog({ mode: 'edit', skill }) }}
                      className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dialog */}
      {dialog && (
        <SkillDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
          onDeleted={(id) => setSkills((prev) => prev.filter((s) => s._id !== id))}
        />
      )}
    </div>
  )
}
