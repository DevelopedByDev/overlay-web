export type AutomationScheduleDraft =
  | { kind: 'interval'; intervalMinutes: number }
  | { kind: 'daily'; hourUTC: number; minuteUTC: number }
  | { kind: 'weekly'; dayOfWeekUTC: number; hourUTC: number; minuteUTC: number }
  | { kind: 'monthly'; dayOfMonthUTC: number; hourUTC: number; minuteUTC: number }

export interface AutomationDraftSummary {
  name: string
  description: string
  instructions: string
  schedule: AutomationScheduleDraft
  timezone: string
  detectedIntegrations: string[]
  missingFields: string[]
  confidence: 'low' | 'medium' | 'high'
  reason: string
}

const KNOWN_INTEGRATIONS = [
  'Gmail',
  'Google Calendar',
  'Google Sheets',
  'Google Drive',
  'Slack',
  'Notion',
  'GitHub',
  'Linear',
  'Discord',
  'Outlook',
  'HubSpot',
  'Salesforce',
  'Airtable',
  'Jira',
  'Asana',
] as const

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function clip(value: string, max = 220): string {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trim()}...`
}

function inferTitle(userText: string): string {
  const cleaned = normalizeWhitespace(
    userText
      .replace(/^(please|can you|could you|help me|i want you to)\s+/i, '')
      .replace(/^(every|each|scheduled|automate)\s+/i, ''),
  )
  const base = cleaned.split(/[.!\n]/)[0] ?? cleaned
  const titled = base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Scheduled automation'
  return titled.length > 72 ? `${titled.slice(0, 69).trim()}...` : titled
}

function detectIntegrations(text: string): string[] {
  const normalized = text.toLowerCase()
  return KNOWN_INTEGRATIONS.filter((name) => normalized.includes(name.toLowerCase()))
}

function inferSchedule(text: string): AutomationScheduleDraft {
  const normalized = text.toLowerCase()
  if (/\b(hourly|every hour)\b/.test(normalized)) {
    return { kind: 'interval', intervalMinutes: 60 }
  }
  if (/\b(every\s+(\d+)\s+minutes?)\b/.test(normalized)) {
    const match = normalized.match(/\bevery\s+(\d+)\s+minutes?\b/)
    const minutes = Math.max(1, Math.min(24 * 60, Number(match?.[1] ?? 60)))
    return { kind: 'interval', intervalMinutes: minutes }
  }
  if (/\bweekly|every week|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?\b/.test(normalized)) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayOfWeekUTC = weekdays.findIndex((day) => normalized.includes(day))
    return { kind: 'weekly', dayOfWeekUTC: dayOfWeekUTC >= 0 ? dayOfWeekUTC : 1, hourUTC: 14, minuteUTC: 0 }
  }
  if (/\bmonthly|every month\b/.test(normalized)) {
    return { kind: 'monthly', dayOfMonthUTC: 1, hourUTC: 14, minuteUTC: 0 }
  }
  return { kind: 'daily', hourUTC: 14, minuteUTC: 0 }
}

export function buildAutomationDraftFromTurn(input: {
  userText: string
  assistantText?: string
  reason?: string
  timezone?: string
}): AutomationDraftSummary {
  const source = [input.userText, input.assistantText].filter(Boolean).join('\n')
  const schedule = inferSchedule(source)
  const detectedIntegrations = detectIntegrations(source)
  const missingFields: string[] = []
  if (!/\b(hourly|daily|weekly|monthly|every|morning|evening|night|at\s+\d)/i.test(source)) {
    missingFields.push('Confirm schedule')
  }
  if (detectedIntegrations.length === 0) {
    missingFields.push('Confirm required integrations')
  }

  const name = inferTitle(input.userText)
  return {
    name,
    description: clip(input.reason || 'Scheduled workflow from automation chat.', 140),
    instructions: [
      `Automation: ${name}`,
      '',
      'When this automation runs, follow this workflow:',
      clip(input.assistantText || input.userText, 900),
      '',
      'Report what was completed and anything that still needs attention.',
    ].join('\n'),
    schedule,
    timezone: input.timezone || 'UTC',
    detectedIntegrations,
    missingFields,
    confidence: missingFields.length === 0 ? 'high' : detectedIntegrations.length > 0 ? 'medium' : 'low',
    reason: input.reason || 'This looks like a recurring or scheduled workflow.',
  }
}
