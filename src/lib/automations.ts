export type AutomationSourceType = 'skill' | 'inline'
export type AutomationMode = 'ask' | 'act'
export type AutomationStatus = 'active' | 'paused' | 'archived'
export type AutomationScheduleKind = 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly'
export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'canceled'

export interface AutomationScheduleConfig {
  onceAt?: number
  localTime?: string
  weekdays?: number[]
  dayOfMonth?: number
}

export interface AutomationSummary {
  _id: string
  userId: string
  title: string
  description: string
  sourceType: AutomationSourceType
  skillId?: string
  instructionsMarkdown?: string
  mode: AutomationMode
  modelId: string
  projectId?: string
  status: AutomationStatus
  timezone: string
  scheduleKind: AutomationScheduleKind
  scheduleConfig: AutomationScheduleConfig
  nextRunAt?: number
  lastRunAt?: number
  lastRunStatus?: AutomationRunStatus
  conversationId?: string
  createdAt: number
  updatedAt: number
}

export interface AutomationRunSummary {
  _id: string
  automationId: string
  userId: string
  status: AutomationRunStatus
  triggerSource: 'manual' | 'schedule' | 'retry'
  scheduledFor: number
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  conversationId?: string
  turnId?: string
  promptSnapshot: string
  mode: AutomationMode
  modelId: string
  resultSummary?: string
  errorCode?: string
  errorMessage?: string
  createdAt: number
}

export interface AutomationToolInvocationSummary {
  _id: string
  toolId: string
  mode: AutomationMode
  modelId?: string
  conversationId?: string
  turnId?: string
  success: boolean
  durationMs?: number
  costBucket: 'perplexity' | 'image' | 'video' | 'browser' | 'daytona' | 'composio' | 'internal'
  errorMessage?: string
  createdAt: number
}

export interface AutomationOutputSummary {
  _id: string
  type: string
  status: 'pending' | 'completed' | 'failed'
  url?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  modelId: string
  conversationId?: string
  turnId?: string
  errorMessage?: string
  createdAt: number
  completedAt?: number
}

export interface AutomationRunDetail {
  run: AutomationRunSummary
  automation?: Pick<AutomationSummary, '_id' | 'title' | 'description' | 'mode' | 'modelId'>
  userMessage?: string
  assistantMessage?: string
  tools: AutomationToolInvocationSummary[]
  outputs: AutomationOutputSummary[]
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

function getZonedParts(timestamp: number, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = formatter.formatToParts(new Date(timestamp))
  const lookup = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  const weekdayLabel = lookup('weekday')
  return {
    year: Number(lookup('year')),
    month: Number(lookup('month')),
    day: Number(lookup('day')),
    hour: Number(lookup('hour')),
    minute: Number(lookup('minute')),
    second: Number(lookup('second')),
    weekday: WEEKDAY_LABELS.findIndex((label) => label === weekdayLabel),
  }
}

function parseLocalTime(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function normalizeYmd(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const normalized = new Date(Date.UTC(year, month - 1, day))
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
  }
}

function addDaysToYmd(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  return normalizeYmd(year, month, day + deltaDays)
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function zonedLocalTimeToUtc(
  timezone: string,
  parts: { year: number; month: number; day: number; hour: number; minute: number },
): number {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0)
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const zoned = getZonedParts(guess, timezone)
    const actualUtcForZonedView = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      0,
    )
    const desiredUtcForLocalView = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0,
    )
    const delta = desiredUtcForLocalView - actualUtcForZonedView
    guess += delta
    if (delta === 0) break
  }
  return guess
}

function matchesScheduleOnDay(
  scheduleKind: AutomationScheduleKind,
  scheduleConfig: AutomationScheduleConfig,
  weekday: number,
): boolean {
  if (scheduleKind === 'daily') return true
  if (scheduleKind === 'weekdays') return weekday >= 1 && weekday <= 5
  if (scheduleKind === 'weekly') {
    const weekdays = scheduleConfig.weekdays ?? []
    return weekdays.includes(weekday)
  }
  return false
}

export function getNextAutomationRunAt(input: {
  scheduleKind: AutomationScheduleKind
  scheduleConfig: AutomationScheduleConfig
  timezone: string
  afterTimestamp: number
}): number | undefined {
  const { scheduleKind, scheduleConfig, timezone } = input
  const afterTimestamp = input.afterTimestamp

  if (scheduleKind === 'once') {
    return scheduleConfig.onceAt && scheduleConfig.onceAt > afterTimestamp
      ? scheduleConfig.onceAt
      : undefined
  }

  const localTime = parseLocalTime(scheduleConfig.localTime)
  if (!localTime) return undefined

  const anchor = getZonedParts(afterTimestamp + 60_000, timezone)
  for (let dayOffset = 0; dayOffset < 400; dayOffset += 1) {
    const day = addDaysToYmd(anchor.year, anchor.month, anchor.day, dayOffset)
    const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()
    if (scheduleKind === 'monthly') {
      const desiredDay = Math.min(
        Math.max(1, scheduleConfig.dayOfMonth ?? 1),
        getDaysInMonth(day.year, day.month),
      )
      if (day.day !== desiredDay) {
        continue
      }
    } else if (!matchesScheduleOnDay(scheduleKind, scheduleConfig, weekday)) {
      continue
    }

    const candidate = zonedLocalTimeToUtc(timezone, {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: localTime.hour,
      minute: localTime.minute,
    })
    if (candidate > afterTimestamp) {
      return candidate
    }
  }

  return undefined
}

function formatDateInTimeZone(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(timestamp)
}

function formatWeekdayList(weekdays: number[]): string {
  const uniq = [...new Set(weekdays)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((a, b) => a - b)
  if (uniq.length === 0) return 'selected days'
  if (uniq.length === 7) return 'every day'
  return uniq.map((value) => WEEKDAY_LABELS[value]!).join(', ')
}

export function formatAutomationSchedule(
  scheduleKind: AutomationScheduleKind,
  scheduleConfig: AutomationScheduleConfig,
  timezone: string,
): string {
  if (scheduleKind === 'once') {
    if (!scheduleConfig.onceAt) return 'One time'
    return `Once on ${formatDateInTimeZone(scheduleConfig.onceAt, timezone)}`
  }
  if (scheduleKind === 'daily') {
    return `Every day at ${scheduleConfig.localTime ?? 'scheduled time'}`
  }
  if (scheduleKind === 'weekdays') {
    return `Weekdays at ${scheduleConfig.localTime ?? 'scheduled time'}`
  }
  if (scheduleKind === 'weekly') {
    return `${formatWeekdayList(scheduleConfig.weekdays ?? [])} at ${scheduleConfig.localTime ?? 'scheduled time'}`
  }
  return `Day ${scheduleConfig.dayOfMonth ?? 1} of each month at ${scheduleConfig.localTime ?? 'scheduled time'}`
}

export function getAutomationStatusLabel(status: AutomationStatus): string {
  if (status === 'paused') return 'Paused'
  if (status === 'archived') return 'Archived'
  return 'Active'
}

export function getAutomationRunStatusLabel(status?: AutomationRunStatus): string {
  if (!status) return 'Never run'
  if (status === 'succeeded') return 'Succeeded'
  if (status === 'failed') return 'Failed'
  if (status === 'running') return 'Running'
  if (status === 'queued') return 'Queued'
  if (status === 'skipped') return 'Skipped'
  return 'Canceled'
}

export function buildAutomationPrompt(input: {
  title: string
  description?: string
  scheduleLabel: string
  timezone: string
  sourceInstructions: string
}): string {
  const descriptionLine = input.description?.trim()
    ? `Description: ${input.description.trim()}\n`
    : ''

  return (
    `Run the automation "${input.title}".\n` +
    descriptionLine +
    `Schedule: ${input.scheduleLabel}\n` +
    `Timezone: ${input.timezone}\n\n` +
    `Follow these instructions exactly:\n\n${input.sourceInstructions.trim()}`
  )
}
