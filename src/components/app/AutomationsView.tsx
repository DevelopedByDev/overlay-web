'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar,
  Check,
  LayoutGrid,
  LayoutList,
  Loader2,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from 'lucide-react'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, getChatModelDisplayName } from '@/lib/models'
import {
  formatAutomationSchedule,
  getAutomationRunStatusLabel,
  getAutomationStatusLabel,
  type AutomationRunSummary,
  type AutomationScheduleConfig,
  type AutomationScheduleKind,
  type AutomationSummary,
} from '@/lib/automations'

type Skill = {
  _id: string
  name: string
  description: string
  instructions: string
  enabled?: boolean
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; automation: AutomationSummary }

type FormState = {
  title: string
  description: string
  sourceType: 'skill' | 'inline'
  skillId: string
  instructionsMarkdown: string
  mode: 'ask' | 'act'
  modelId: string
  status: 'active' | 'paused' | 'archived'
  timezone: string
  scheduleKind: AutomationScheduleKind
  onceAt: string
  localTime: string
  weekdays: number[]
  dayOfMonth: number
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Never'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTimestamp(ts?: number, timezone?: string): string {
  if (!ts) return 'Not scheduled'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(ts)
}

function toDatetimeLocalValue(ts?: number): string {
  if (!ts) return ''
  const date = new Date(ts)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function buildFormState(automation?: AutomationSummary): FormState {
  const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return {
    title: automation?.title ?? '',
    description: automation?.description ?? '',
    sourceType: automation?.sourceType ?? 'skill',
    skillId: automation?.skillId ?? '',
    instructionsMarkdown: automation?.instructionsMarkdown ?? '',
    mode: automation?.mode ?? 'act',
    modelId: automation?.modelId ?? DEFAULT_MODEL_ID,
    status: automation?.status ?? 'active',
    timezone: automation?.timezone ?? fallbackTimezone,
    scheduleKind: automation?.scheduleKind ?? 'daily',
    onceAt: toDatetimeLocalValue(automation?.scheduleConfig.onceAt),
    localTime: automation?.scheduleConfig.localTime ?? '09:00',
    weekdays: automation?.scheduleConfig.weekdays ?? [1, 2, 3, 4, 5],
    dayOfMonth: automation?.scheduleConfig.dayOfMonth ?? 1,
  }
}

function buildScheduleConfig(form: FormState): AutomationScheduleConfig {
  if (form.scheduleKind === 'once') {
    return { onceAt: form.onceAt ? new Date(form.onceAt).getTime() : undefined }
  }
  if (form.scheduleKind === 'weekly') {
    return { localTime: form.localTime, weekdays: form.weekdays }
  }
  if (form.scheduleKind === 'monthly') {
    return { localTime: form.localTime, dayOfMonth: form.dayOfMonth }
  }
  return { localTime: form.localTime }
}

function AutomationActions({
  onRun,
  onEdit,
  onDelete,
  running,
  deleting,
}: {
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  running?: boolean
  deleting?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="inline-flex items-center gap-1 rounded-md bg-[#0a0a0a] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#222] disabled:opacity-50"
      >
        {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        Run
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center justify-center rounded-md border border-[#e5e5e5] p-1.5 text-[#666] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="inline-flex items-center justify-center rounded-md border border-[#e5e5e5] p-1.5 text-[#888] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </div>
  )
}

function AutomationDialog({
  state,
  skills,
  runs,
  loadingRuns,
  onClose,
  onSaved,
  onDeleted,
  onRunNow,
}: {
  state: DialogState
  skills: Skill[]
  runs: AutomationRunSummary[]
  loadingRuns: boolean
  onClose: () => void
  onSaved: (automation: AutomationSummary) => void
  onDeleted: (automationId: string) => void
  onRunNow: (automationId: string) => Promise<void>
}) {
  const isEdit = state.mode === 'edit'
  const initial = isEdit ? state.automation : undefined
  const [form, setForm] = useState<FormState>(() => buildFormState(initial))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [running, setRunning] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  const scheduleLabel = useMemo(
    () => formatAutomationSchedule(form.scheduleKind, buildScheduleConfig(form), form.timezone),
    [form],
  )

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        ...(isEdit ? { automationId: initial!._id } : {}),
        title: form.title || 'Untitled automation',
        description: form.description,
        sourceType: form.sourceType,
        skillId: form.sourceType === 'skill' ? form.skillId || undefined : undefined,
        instructionsMarkdown: form.sourceType === 'inline' ? form.instructionsMarkdown : undefined,
        mode: form.mode,
        modelId: form.modelId,
        status: form.status,
        timezone: form.timezone,
        scheduleKind: form.scheduleKind,
        scheduleConfig: buildScheduleConfig(form),
      }
      const res = await fetch('/api/app/automations', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return

      if (isEdit) {
        onSaved({
          ...initial!,
          ...payload,
          scheduleConfig: payload.scheduleConfig,
          updatedAt: Date.now(),
        } as AutomationSummary)
      } else {
        const data = (await res.json()) as { id: string }
        onSaved({
          _id: data.id,
          userId: '',
          title: payload.title,
          description: payload.description,
          sourceType: payload.sourceType,
          skillId: payload.skillId,
          instructionsMarkdown: payload.instructionsMarkdown,
          mode: payload.mode,
          modelId: payload.modelId,
          status: payload.status,
          timezone: payload.timezone,
          scheduleKind: payload.scheduleKind,
          scheduleConfig: payload.scheduleConfig,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as AutomationSummary)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit || deleting) return
    if (!window.confirm('Delete this automation?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/app/automations?automationId=${encodeURIComponent(initial!._id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) return
      onDeleted(initial!._id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  async function handleRunNow() {
    if (!isEdit || running) return
    setRunning(true)
    try {
      await onRunNow(initial!._id)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-[#e5e5e5] bg-white shadow-xl" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-[#0a0a0a]">{isEdit ? 'Edit automation' : 'New automation'}</h3>
            <p className="text-[11px] text-[#888]">{scheduleLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => void handleRunNow()}
                disabled={running}
                className="inline-flex items-center gap-1 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#222] disabled:opacity-50"
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run now
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded p-1 text-[#888] transition-colors hover:bg-[#f5f5f5] hover:text-[#0a0a0a]">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1.25fr_0.75fr]">
          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Title</label>
                <input
                  ref={titleRef}
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  placeholder="e.g. Morning research brief"
                  className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a] focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  placeholder="Short summary shown in the list"
                  className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a] focus:bg-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Mode</label>
                  <select
                    value={form.mode}
                    onChange={(e) => setForm((current) => ({ ...current, mode: e.target.value as 'ask' | 'act' }))}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:bg-white"
                  >
                    <option value="act">Act</option>
                    <option value="ask">Ask</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as FormState['status'] }))}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Automation source</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, sourceType: 'skill' }))}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${form.sourceType === 'skill' ? 'border-[#0a0a0a] bg-white text-[#0a0a0a]' : 'border-[#e5e5e5] bg-[#fafafa] text-[#666]'}`}
                  >
                    Use an existing skill
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, sourceType: 'inline' }))}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${form.sourceType === 'inline' ? 'border-[#0a0a0a] bg-white text-[#0a0a0a]' : 'border-[#e5e5e5] bg-[#fafafa] text-[#666]'}`}
                  >
                    Write inline markdown
                  </button>
                </div>
              </div>

              {form.sourceType === 'skill' ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Skill</label>
                  <select
                    value={form.skillId}
                    onChange={(e) => setForm((current) => ({ ...current, skillId: e.target.value }))}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:bg-white"
                  >
                    <option value="">Select a skill</option>
                    {skills.filter((skill) => skill.enabled !== false).map((skill) => (
                      <option key={skill._id} value={skill._id}>{skill.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Instructions</label>
                  <textarea
                    value={form.instructionsMarkdown}
                    onChange={(e) => setForm((current) => ({ ...current, instructionsMarkdown: e.target.value }))}
                    rows={8}
                    placeholder="Describe what should happen when this automation runs."
                    className="w-full resize-none rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a] focus:bg-white"
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Model</label>
                  <select
                    value={form.modelId}
                    onChange={(e) => setForm((current) => ({ ...current, modelId: e.target.value }))}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:bg-white"
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Timezone</label>
                  <input
                    value={form.timezone}
                    onChange={(e) => setForm((current) => ({ ...current, timezone: e.target.value }))}
                    className="w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="flex items-center gap-2 text-sm text-[#0a0a0a]">
                  <Calendar size={14} />
                  Schedule
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Frequency</label>
                    <select
                      value={form.scheduleKind}
                      onChange={(e) => setForm((current) => ({ ...current, scheduleKind: e.target.value as AutomationScheduleKind }))}
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    >
                      <option value="once">One time</option>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {form.scheduleKind === 'once' ? (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Date & time</label>
                      <input
                        type="datetime-local"
                        value={form.onceAt}
                        onChange={(e) => setForm((current) => ({ ...current, onceAt: e.target.value }))}
                        className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Time</label>
                      <input
                        type="time"
                        value={form.localTime}
                        onChange={(e) => setForm((current) => ({ ...current, localTime: e.target.value }))}
                        className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                      />
                    </div>
                  )}
                </div>

                {form.scheduleKind === 'weekly' ? (
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => {
                      const active = form.weekdays.includes(index)
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setForm((current) => ({
                            ...current,
                            weekdays: active
                              ? current.weekdays.filter((value) => value !== index)
                              : [...current.weekdays, index].sort((a, b) => a - b),
                          }))}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? 'border-[#0a0a0a] bg-white text-[#0a0a0a]' : 'border-[#dedede] bg-white text-[#777]'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {form.scheduleKind === 'monthly' ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#888]">Day of month</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dayOfMonth}
                      onChange={(e) => setForm((current) => ({ ...current, dayOfMonth: Number(e.target.value) || 1 }))}
                      className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a]"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-t border-[#e5e5e5] bg-[#fafafa] px-5 py-5 md:border-l md:border-t-0">
            <div className="space-y-4">
              <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#555]">
                <p className="font-medium text-[#0a0a0a]">{form.title || 'Untitled automation'}</p>
                <p className="mt-1 text-[12px] text-[#888]">{form.description || 'No description yet'}</p>
                <div className="mt-3 space-y-1 text-[12px]">
                  <p>Schedule: {scheduleLabel}</p>
                  <p>Status: {getAutomationStatusLabel(form.status)}</p>
                  <p>Mode: {form.mode === 'act' ? 'Act' : 'Ask'}</p>
                  <p>Model: {getChatModelDisplayName(form.modelId)}</p>
                </div>
              </div>

              {isEdit ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-[#0a0a0a]">Recent runs</h4>
                    {loadingRuns ? <Loader2 size={13} className="animate-spin text-[#888]" /> : null}
                  </div>
                  {loadingRuns ? (
                    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#888]">Loading runs…</div>
                  ) : runs.length === 0 ? (
                    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#888]">No runs yet</div>
                  ) : runs.map((run) => (
                    <div key={run._id} className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-[#0a0a0a]">{getAutomationRunStatusLabel(run.status)}</div>
                        <div className="text-[11px] text-[#888]">{timeAgo(run.createdAt)}</div>
                      </div>
                      <p className="mt-1 text-[11px] text-[#888]">{run.resultSummary || run.errorMessage || 'Run completed without a summary.'}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#e5e5e5] px-5 py-3">
          <div>
            {isEdit ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-1 text-xs text-[#888] transition-colors hover:text-red-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-4 py-1.5 text-xs text-white transition-colors hover:bg-[#222] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationsView({ userId: _userId }: { userId: string }) {
  void _userId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const layout = searchParams?.get('layout') === 'list' ? 'list' : 'cards'

  const [automations, setAutomations] = useState<AutomationSummary[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [runs, setRuns] = useState<AutomationRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({})
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({})

  const updateQuery = useCallback((nextLayout: 'list' | 'cards') => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('layout', nextLayout)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/app/automations')
      if (res.ok) setAutomations(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSkills = useCallback(async () => {
    const res = await fetch('/api/app/skills')
    if (res.ok) setSkills(await res.json())
  }, [])

  const loadRuns = useCallback(async (automationId: string) => {
    setLoadingRuns(true)
    try {
      const res = await fetch(`/api/app/automations/runs?automationId=${encodeURIComponent(automationId)}&limit=12`)
      if (res.ok) setRuns(await res.json())
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    void loadAutomations()
    void loadSkills()
  }, [loadAutomations, loadSkills])

  useEffect(() => {
    if (dialog?.mode === 'edit') {
      void loadRuns(dialog.automation._id)
    } else {
      setRuns([])
    }
  }, [dialog, loadRuns])

  function handleSaved(automation: AutomationSummary) {
    setAutomations((prev) => {
      const index = prev.findIndex((item) => item._id === automation._id)
      if (index >= 0) {
        const next = [...prev]
        next[index] = { ...next[index], ...automation }
        return next
      }
      return [automation, ...prev]
    })
  }

  function handleDeleted(automationId: string) {
    setAutomations((prev) => prev.filter((item) => item._id !== automationId))
  }

  async function handleDelete(automationId: string) {
    if (!window.confirm('Delete this automation?')) return
    setDeletingIds((prev) => ({ ...prev, [automationId]: true }))
    try {
      const res = await fetch(`/api/app/automations?automationId=${encodeURIComponent(automationId)}`, { method: 'DELETE' })
      if (!res.ok) return
      handleDeleted(automationId)
    } finally {
      setDeletingIds((prev) => ({ ...prev, [automationId]: false }))
    }
  }

  async function handleRunNow(automationId: string) {
    setRunningIds((prev) => ({ ...prev, [automationId]: true }))
    try {
      const res = await fetch('/api/app/automations/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId }),
      })
      if (!res.ok) return
      await loadAutomations()
      if (dialog?.mode === 'edit' && dialog.automation._id === automationId) {
        await loadRuns(automationId)
      }
    } finally {
      setRunningIds((prev) => ({ ...prev, [automationId]: false }))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e5e5] px-6">
        <div>
          <h2 className="text-sm font-medium text-[#0a0a0a]">Automations</h2>
          <p className="text-[11px] text-[#888]">Scheduled skill and markdown runs with manual play, edit, and delete actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[#e5e5e5] bg-white p-1">
            <button type="button" onClick={() => updateQuery('cards')} className={`rounded px-2 py-1 text-xs ${layout === 'cards' ? 'bg-[#0a0a0a] text-white' : 'text-[#666]'}`}>
              <LayoutGrid size={13} />
            </button>
            <button type="button" onClick={() => updateQuery('list')} className={`rounded px-2 py-1 text-xs ${layout === 'list' ? 'bg-[#0a0a0a] text-white' : 'text-[#666]'}`}>
              <LayoutList size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDialog({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#222]"
          >
            <Plus size={12} />
            New automation
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[#888]" />
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Workflow size={40} strokeWidth={1} className="text-[#ccc]" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-[#525252]">No automations yet</p>
            <p className="text-xs text-[#aaa]">Create a scheduled workflow backed by a skill or inline markdown instructions.</p>
          </div>
          <button
            type="button"
            onClick={() => setDialog({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0a0a0a] px-4 py-2 text-sm text-white transition-colors hover:bg-[#222]"
          >
            <Plus size={14} />
            New automation
          </button>
        </div>
      ) : layout === 'list' ? (
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
            {automations.map((automation) => (
              <div key={automation._id} className="flex items-center gap-3 border-b border-[#f0f0f0] px-4 py-3 last:border-b-0">
                <button type="button" onClick={() => setDialog({ mode: 'edit', automation })} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-[#0a0a0a]">{automation.title}</p>
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] text-[#666]">{getAutomationStatusLabel(automation.status)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[#888]">{automation.description || 'No description'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#aaa]">
                    <span>{formatAutomationSchedule(automation.scheduleKind, automation.scheduleConfig, automation.timezone)}</span>
                    <span>·</span>
                    <span>Next: {formatTimestamp(automation.nextRunAt, automation.timezone)}</span>
                    <span>·</span>
                    <span>Last: {getAutomationRunStatusLabel(automation.lastRunStatus)} {automation.lastRunAt ? `(${timeAgo(automation.lastRunAt)})` : ''}</span>
                  </div>
                </button>
                <AutomationActions
                  onRun={() => void handleRunNow(automation._id)}
                  onEdit={() => setDialog({ mode: 'edit', automation })}
                  onDelete={() => void handleDelete(automation._id)}
                  running={runningIds[automation._id]}
                  deleting={deletingIds[automation._id]}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {automations.map((automation) => (
                <div key={automation._id} className="rounded-xl border border-[#e5e5e5] bg-white p-4">
                  <button type="button" onClick={() => setDialog({ mode: 'edit', automation })} className="block w-full text-left">
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f5f5f5]">
                        {automation.sourceType === 'skill' ? <Sparkles size={14} className="text-[#888]" /> : <Workflow size={14} className="text-[#888]" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#0a0a0a]">{automation.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[#888]">{automation.description || 'No description'}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-[11px] text-[#888]">
                      <p>{formatAutomationSchedule(automation.scheduleKind, automation.scheduleConfig, automation.timezone)}</p>
                      <p>Next: {formatTimestamp(automation.nextRunAt, automation.timezone)}</p>
                      <p>Last: {getAutomationRunStatusLabel(automation.lastRunStatus)}</p>
                    </div>
                  </button>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] text-[#666]">{getAutomationStatusLabel(automation.status)}</span>
                    <AutomationActions
                      onRun={() => void handleRunNow(automation._id)}
                      onEdit={() => setDialog({ mode: 'edit', automation })}
                      onDelete={() => void handleDelete(automation._id)}
                      running={runningIds[automation._id]}
                      deleting={deletingIds[automation._id]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {dialog ? (
        <AutomationDialog
          state={dialog}
          skills={skills}
          runs={runs}
          loadingRuns={loadingRuns}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onRunNow={handleRunNow}
        />
      ) : null}
    </div>
  )
}
