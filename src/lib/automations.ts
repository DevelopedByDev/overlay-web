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
  promptSnapshot: string
  mode: AutomationMode
  modelId: string
  resultSummary?: string
  errorCode?: string
  errorMessage?: string
  createdAt: number
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

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
