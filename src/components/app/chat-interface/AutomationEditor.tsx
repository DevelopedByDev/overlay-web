'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Play, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { AutomationInstructionsEditor } from './AutomationInstructionsEditor'
import { DEFAULT_MODEL_ID } from '@/lib/model-types'
import { getModelsByIntelligence } from '@/lib/model-data'

export type AutomationDetailTab = 'chat' | 'edit'

export type AutomationSchedule =
  | { kind: 'interval'; intervalMinutes?: number }
  | { kind: 'daily'; hourUTC?: number; minuteUTC?: number }
  | { kind: 'weekly'; dayOfWeekUTC?: number; hourUTC?: number; minuteUTC?: number }
  | { kind: 'monthly'; dayOfMonthUTC?: number; hourUTC?: number; minuteUTC?: number }

export type AutomationDetail = {
  _id: string
  name?: string
  title?: string
  description?: string
  instructions?: string
  instructionsMarkdown?: string
  enabled?: boolean
  schedule?: AutomationSchedule
  timezone?: string
  modelId?: string
  graphSource?: string
  sourceConversationId?: string
  conversationId?: string
  nextRunAt?: number
  lastError?: string
}

export const AUTOMATION_DETAIL_TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'edit', label: 'Edit', icon: SlidersHorizontal },
] satisfies Array<{ id: AutomationDetailTab; label: string; icon: typeof MessageSquare }>

const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
type TimeZoneOption = {
  label: string
  offsetMinutes: number
  value: string
}

function supportedTimeZones(): string[] {
  try {
    const values = Intl.supportedValuesOf?.('timeZone')
    return values?.length ? values : FALLBACK_TIME_ZONES
  } catch {
    return FALLBACK_TIME_ZONES
  }
}

function timeZoneOffsetMinutes(timeZone: string, dateMs = Date.now()): number {
  const minuteAlignedDateMs = Math.floor(dateMs / 60_000) * 60_000
  const parts = getTimeZoneParts(minuteAlignedDateMs, timeZone)
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return Math.round((localAsUtc - minuteAlignedDateMs) / 60_000)
}

function formatGmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return `GMT${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function timeZoneCityLabel(timeZone: string): string {
  const parts = timeZone.split('/')
  return (parts.at(-1) || timeZone).replaceAll('_', ' ')
}

function supportedTimeZoneOptions(): TimeZoneOption[] {
  return supportedTimeZones()
    .map((value) => {
      const offsetMinutes = timeZoneOffsetMinutes(value)
      return {
        value,
        offsetMinutes,
        label: `${formatGmtOffset(offsetMinutes)} - ${timeZoneCityLabel(value)}`,
      }
    })
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label))
}

function safeTimeZone(value: string | undefined): string {
  const zones = supportedTimeZones()
  const candidate = value?.trim()
  if (candidate && zones.includes(candidate)) return candidate
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function normalizeAutomationDetailTab(value: string | null | undefined): AutomationDetailTab {
  return value === 'edit' || value === 'graph' ? 'edit' : 'chat'
}

function getAutomationDisplayName(automation: AutomationDetail): string {
  return automation.name || automation.title || 'Untitled automation'
}

function getAutomationInstructions(automation: AutomationDetail): string {
  return automation.instructions || automation.instructionsMarkdown || ''
}

function mermaidLabel(value: string): string {
  return value.replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractAutomationInstructionSteps(instructions: string): string[] {
  const lines = instructions.split('\n')
  const numbered = lines
    .map((line) => line.trim().match(/^\d+\.\s+(.+)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line))
  if (numbered.length > 0) return numbered.slice(0, 10)

  return lines
    .map((line) => line.trim().replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('```'))
    .slice(0, 8)
}

function graphSourceFromAutomationInstructions(automation: AutomationDetail): string {
  const steps = extractAutomationInstructionSteps(getAutomationInstructions(automation))
  if (steps.length === 0) return ''
  const nodes = steps.map((step, index) => {
    const nodeId = `step${index + 1}`
    const label = mermaidLabel(step).slice(0, 96)
    return `  ${nodeId}["${index + 1}. ${label}"]`
  })
  const edges = steps.slice(1).map((_, index) => `  step${index + 1} --> step${index + 2}`)
  return ['flowchart TD', ...nodes, ...edges].join('\n')
}

function defaultAutomationGraphSource(automation: AutomationDetail): string {
  const instructionGraph = graphSourceFromAutomationInstructions(automation)
  if (instructionGraph) return instructionGraph
  const name = mermaidLabel(getAutomationDisplayName(automation))
  const schedule = automation.schedule?.kind ? automation.schedule.kind : 'schedule'
  const model = automation.modelId || DEFAULT_MODEL_ID
  return [
    'flowchart TD',
    `  trigger["${schedule} trigger"] --> instructions["${name} instructions"]`,
    `  instructions --> model["Run with ${model}"]`,
    '  model --> output["Write result to automation chat"]',
  ].join('\n')
}

function getTimeZoneParts(dateMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(new Date(dateMs))
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = read('weekday')
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday),
  }
}

function zonedDateTimeToUtcMs(input: {
  timeZone: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}): number {
  const targetUtcLike = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0)
  let candidate = targetUtcLike
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = getTimeZoneParts(candidate, input.timeZone)
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0)
    candidate -= asUtc - targetUtcLike
  }
  return candidate
}

function utcReferenceForSchedule(schedule: AutomationSchedule | undefined): number {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const baseDay = now.getUTCDate()
  const hour = schedule && 'hourUTC' in schedule ? schedule.hourUTC ?? 9 : 9
  const minute = schedule && 'minuteUTC' in schedule ? schedule.minuteUTC ?? 0 : 0
  if (schedule?.kind === 'weekly') {
    const sunday = baseDay - now.getUTCDay()
    return Date.UTC(year, month, sunday + (schedule.dayOfWeekUTC ?? 1), hour, minute)
  }
  if (schedule?.kind === 'monthly') {
    return Date.UTC(year, month, schedule.dayOfMonthUTC ?? 1, hour, minute)
  }
  return Date.UTC(year, month, baseDay, hour, minute)
}

function localFieldsFromSchedule(schedule: AutomationSchedule | undefined, timeZone: string) {
  const parts = getTimeZoneParts(utcReferenceForSchedule(schedule), timeZone)
  return {
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
    dayOfWeek: parts.dayOfWeek >= 0 ? parts.dayOfWeek : 1,
    dayOfMonth: Math.min(31, Math.max(1, parts.day || 1)),
  }
}

function parseAutomationTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : 9,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.floor(minute))) : 0,
  }
}

function buildAutomationSchedule(input: {
  kind: AutomationSchedule['kind']
  intervalMinutes: number
  time: string
  dayOfWeek: number
  dayOfMonth: number
  timeZone: string
}): AutomationSchedule {
  if (input.kind === 'interval') {
    return {
      kind: 'interval',
      intervalMinutes: Math.max(1, Math.floor(input.intervalMinutes) || 60),
    }
  }
  const nowParts = getTimeZoneParts(Date.now(), input.timeZone)
  const localTime = parseAutomationTime(input.time)
  let localYear = nowParts.year
  let localMonth = nowParts.month
  let localDay = nowParts.day
  if (input.kind === 'weekly') {
    const today = nowParts.dayOfWeek >= 0 ? nowParts.dayOfWeek : 0
    const target = Math.min(6, Math.max(0, Math.floor(input.dayOfWeek)))
    const offset = (target - today + 7) % 7
    const base = new Date(zonedDateTimeToUtcMs({
      timeZone: input.timeZone,
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: 12,
      minute: 0,
    }))
    const candidate = getTimeZoneParts(base.getTime() + offset * 24 * 60 * 60_000, input.timeZone)
    localYear = candidate.year
    localMonth = candidate.month
    localDay = candidate.day
  } else if (input.kind === 'monthly') {
    localDay = Math.min(31, Math.max(1, Math.floor(input.dayOfMonth)))
  }
  const utc = new Date(zonedDateTimeToUtcMs({
    timeZone: input.timeZone,
    year: localYear,
    month: localMonth,
    day: localDay,
    hour: localTime.hour,
    minute: localTime.minute,
  }))
  if (input.kind === 'weekly') {
    return {
      kind: 'weekly',
      dayOfWeekUTC: utc.getUTCDay(),
      hourUTC: utc.getUTCHours(),
      minuteUTC: utc.getUTCMinutes(),
    }
  }
  if (input.kind === 'monthly') {
    return {
      kind: 'monthly',
      dayOfMonthUTC: utc.getUTCDate(),
      hourUTC: utc.getUTCHours(),
      minuteUTC: utc.getUTCMinutes(),
    }
  }
  return { kind: 'daily', hourUTC: utc.getUTCHours(), minuteUTC: utc.getUTCMinutes() }
}

export function AutomationEditorPanel({
  automation,
  onSaved,
  onTested,
  isFreeTier,
}: {
  automation: AutomationDetail
  onSaved: (automation: AutomationDetail) => void
  onTested: (conversationId: string) => void
  isFreeTier: boolean
}) {
  const initialSchedule = automation.schedule ?? { kind: 'daily', hourUTC: 14, minuteUTC: 0 }
  const [name, setName] = useState(getAutomationDisplayName(automation))
  const [description, setDescription] = useState(automation.description ?? '')
  const [instructions, setInstructions] = useState(getAutomationInstructions(automation))
  const [enabled, setEnabled] = useState(automation.enabled ?? true)
  const [scheduleKind, setScheduleKind] = useState<AutomationSchedule['kind']>(initialSchedule.kind)
  const [intervalMinutes, setIntervalMinutes] = useState(
    initialSchedule.kind === 'interval' ? initialSchedule.intervalMinutes ?? 60 : 60,
  )
  const [timezone, setTimezone] = useState(safeTimeZone(automation.timezone))
  const initialLocalFields = localFieldsFromSchedule(initialSchedule, safeTimeZone(automation.timezone))
  const [time, setTime] = useState(initialLocalFields.time)
  const [dayOfWeek, setDayOfWeek] = useState(initialLocalFields.dayOfWeek)
  const [dayOfMonth, setDayOfMonth] = useState(initialLocalFields.dayOfMonth)
  const [graphSource, setGraphSource] = useState(automation.graphSource || defaultAutomationGraphSource(automation))
  const [modelId, setModelId] = useState(automation.modelId ?? DEFAULT_MODEL_ID)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [testState, setTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const timeZoneOptions = useMemo(() => supportedTimeZoneOptions(), [])
  const modelOptions = useMemo(() => getModelsByIntelligence(isFreeTier).filter((m) => m.id !== 'nvidia/nemotron-nano-9b-v2'), [isFreeTier])

  useEffect(() => {
    const nextSchedule = automation.schedule ?? { kind: 'daily' as const, hourUTC: 14, minuteUTC: 0 }
    const nextTimeZone = safeTimeZone(automation.timezone)
    const nextLocalFields = localFieldsFromSchedule(nextSchedule, nextTimeZone)
    setName(getAutomationDisplayName(automation))
    setDescription(automation.description ?? '')
    setInstructions(getAutomationInstructions(automation))
    setEnabled(automation.enabled ?? true)
    setScheduleKind(nextSchedule.kind)
    setIntervalMinutes(nextSchedule.kind === 'interval' ? nextSchedule.intervalMinutes ?? 60 : 60)
    setTimezone(nextTimeZone)
    setTime(nextLocalFields.time)
    setDayOfWeek(nextLocalFields.dayOfWeek)
    setDayOfMonth(nextLocalFields.dayOfMonth)
    setGraphSource(automation.graphSource || defaultAutomationGraphSource(automation))
    setModelId(automation.modelId ?? DEFAULT_MODEL_ID)
    setSaveState('idle')
    setTestState('idle')
    setTestMessage(null)
  }, [automation])

  const schedule = buildAutomationSchedule({
    kind: scheduleKind,
    intervalMinutes,
    time,
    dayOfWeek,
    dayOfMonth,
    timeZone: timezone,
  })

  async function saveAutomation() {
    if (!name.trim() || !instructions.trim()) return
    setSaveState('saving')
    try {
      const instructionsChanged = instructions.trim() !== getAutomationInstructions(automation).trim()
      const nextGraphSource = instructionsChanged
        ? graphSourceFromAutomationInstructions({ ...automation, instructions }) || defaultAutomationGraphSource({ ...automation, instructions })
        : graphSource
      const res = await fetch('/api/app/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationId: automation._id,
          name,
          description,
          instructions,
          enabled,
          schedule,
          timezone,
          graphSource: nextGraphSource,
          modelId,
        }),
      })
      if (!res.ok) throw new Error('Failed to save automation')
      setGraphSource(nextGraphSource)
      const updated = {
        ...automation,
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        enabled,
        schedule,
        timezone,
        graphSource: nextGraphSource,
        modelId,
      }
      onSaved(updated)
      window.dispatchEvent(new Event('overlay:automations-updated'))
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('error')
    }
  }

  async function testAutomation() {
    setTestState('running')
    setTestMessage(null)
    try {
      const res = await fetch('/api/app/automations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: automation._id }),
      })
      const data = await res.json().catch(() => ({})) as {
        conversationId?: string
        message?: string
        error?: string
      }
      if (!res.ok || !data.conversationId) {
        throw new Error(data.message || data.error || 'Failed to test automation')
      }
      setTestState('success')
      setTestMessage('Test run completed. Opening the automation chat.')
      onTested(data.conversationId)
    } catch (error) {
      setTestState('error')
      setTestMessage(error instanceof Error ? error.message : 'Failed to test automation')
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Automation editor</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Tune the saved instructions, schedule, timezone, and run a test.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnabled((value) => !value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                }`}
              >
                {enabled ? 'Enabled' : 'Paused'}
              </button>
              <button
                type="button"
                onClick={() => void saveAutomation()}
                disabled={saveState === 'saving' || !name.trim() || !instructions.trim()}
                className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="space-y-4">
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                    />
                  </label>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Description
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Frequency
                    <select
                      value={scheduleKind}
                      onChange={(event) => setScheduleKind(event.target.value as AutomationSchedule['kind'])}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      <option value="interval">Interval</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  {scheduleKind === 'interval' ? (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Every N minutes
                      <input
                        type="number"
                        min={1}
                        value={intervalMinutes}
                        onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  ) : (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Time
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  )}
                  {scheduleKind === 'weekly' && (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Day of week
                      <select
                        value={dayOfWeek}
                        onChange={(event) => setDayOfWeek(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                      >
                        {WEEKDAY_LABELS.map((day, index) => (
                          <option key={day} value={index}>{day}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {scheduleKind === 'monthly' && (
                    <label className="block text-xs font-medium text-[var(--muted)]">
                      Day of month
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(event) => setDayOfMonth(Number(event.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] outline-none"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Time zone
                    <select
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      {timeZoneOptions.map((zone) => (
                        <option key={zone.value} value={zone.value}>{zone.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Model
                    <select
                      value={modelId}
                      onChange={(event) => setModelId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-12 text-sm text-[var(--foreground)] outline-none"
                    >
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <label className="block text-xs font-medium text-[var(--muted)]">
                Instructions
                <AutomationInstructionsEditor
                  value={instructions}
                  onChange={setInstructions}
                />
              </label>
            </div>
            <AutomationGraphCanvas
              source={graphSource}
              onSourceChange={setGraphSource}
            />
          </div>
          {saveState === 'error' && (
            <p className="mt-3 text-xs text-red-500">Could not save automation. Please try again.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Test automation</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Runs this automation once now and writes the result into the automation chat.</p>
            </div>
            <button
              type="button"
              onClick={() => void testAutomation()}
              disabled={testState === 'running' || !instructions.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
            >
              <Play size={12} />
              {testState === 'running' ? 'Running...' : 'Test Automation'}
            </button>
          </div>
          {testMessage && (
            <p className={`mt-3 text-xs ${testState === 'error' ? 'text-red-500' : 'text-[var(--muted)]'}`}>
              {testMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function AutomationGraphCanvas({
  source,
  onSourceChange,
}: {
  source: string
  onSourceChange: (source: string) => void
}) {
  const renderIdRef = useRef(`automation-graph-${Math.random().toString(36).slice(2)}`)
  const [svg, setSvg] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function renderGraph() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            fontFamily: 'Inter, ui-sans-serif, system-ui',
            primaryColor: '#f4f4f5',
            primaryTextColor: '#18181b',
            primaryBorderColor: '#d4d4d8',
            lineColor: '#71717a',
          },
        })
        const result = await mermaid.render(`${renderIdRef.current}-${Date.now()}`, source)
        if (!cancelled) {
          setSvg(result.svg)
          setRenderError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setSvg('')
          setRenderError(error instanceof Error ? error.message : 'Could not render Mermaid graph')
        }
      }
    }
    void renderGraph()
    return () => {
      cancelled = true
    }
  }, [source])

  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className={`grid h-full min-h-0 gap-4 ${showSource ? 'md:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.75fr)]' : ''}`}>
        <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
          <div className="flex min-h-full items-center justify-center">
            {renderError ? (
              <p className="max-w-md text-sm text-red-500">{renderError}</p>
            ) : svg ? (
              <div
                className="max-w-full overflow-auto text-[var(--foreground)]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">Rendering graph...</p>
            )}
          </div>
        </div>
        {showSource && (
          <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">Source</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Edit Mermaid source. Save changes persists it.</p>
              </div>
            </div>
            <textarea
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
              spellCheck={false}
              className="h-[calc(100%-4.5rem)] min-h-[20rem] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 font-mono text-xs leading-6 text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
            />
          </div>
        )}
      </div>
      <label className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-sm">
        <input
          type="checkbox"
          checked={showSource}
          onChange={(event) => setShowSource(event.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--foreground)]"
        />
        Source
      </label>
    </div>
  )
}
