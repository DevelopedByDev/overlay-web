export type AutomationMode = 'ask' | 'act'
export type AutomationScheduleKind = 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface AutomationScheduleConfig {
  onceAt?: number
  localTime?: string
  weekdays?: number[]
  dayOfMonth?: number
}

export interface AutomationDraftSummary {
  title: string
  description: string
  mode: AutomationMode
  modelId: string
  instructionsMarkdown: string
  detectedIntegrations: string[]
  suggestedSchedule?: {
    kind: AutomationScheduleKind
    label: string
    config: AutomationScheduleConfig
  }
  confidence: 'low' | 'medium' | 'high'
  reason: string
}

export interface SkillDraftSummary {
  name: string
  description: string
  instructions: string
  detectedIntegrations: string[]
  confidence: 'low' | 'medium' | 'high'
  reason: string
}

export interface ChatAutomationSuggestionSummary {
  kind: 'automation' | 'skill'
  reason: string
  confidence: 'low' | 'medium' | 'high'
}

const DEFAULT_AUTOMATION_DRAFT_MODEL_ID = 'claude-sonnet-4-6'

type KnownIntegration = {
  slug: string
  displayName: string
  aliases: string[]
}

const KNOWN_INTEGRATIONS: KnownIntegration[] = [
  { slug: 'gmail', displayName: 'Gmail', aliases: ['gmail'] },
  { slug: 'googlecalendar', displayName: 'Google Calendar', aliases: ['google calendar', 'googlecalendar'] },
  { slug: 'googlesheets', displayName: 'Google Sheets', aliases: ['google sheets', 'googlesheets'] },
  { slug: 'googledrive', displayName: 'Google Drive', aliases: ['google drive', 'googledrive'] },
  { slug: 'googledocs', displayName: 'Google Docs', aliases: ['google docs', 'googledocs'] },
  { slug: 'slack', displayName: 'Slack', aliases: ['slack'] },
  { slug: 'notion', displayName: 'Notion', aliases: ['notion'] },
  { slug: 'github', displayName: 'GitHub', aliases: ['github', 'gitHub'] },
  { slug: 'linear', displayName: 'Linear', aliases: ['linear'] },
  { slug: 'discord', displayName: 'Discord', aliases: ['discord'] },
  { slug: 'outlook', displayName: 'Outlook', aliases: ['outlook'] },
  { slug: 'calcom', displayName: 'Cal.com', aliases: ['cal.com', 'cal com'] },
  { slug: 'twitter', displayName: 'X (Twitter)', aliases: ['twitter', 'x (twitter)'] },
  { slug: 'hubspot', displayName: 'HubSpot', aliases: ['hubspot', 'hub spot'] },
  { slug: 'salesforce', displayName: 'Salesforce', aliases: ['salesforce'] },
  { slug: 'airtable', displayName: 'Airtable', aliases: ['airtable', 'air table'] },
  { slug: 'zoom', displayName: 'Zoom', aliases: ['zoom'] },
  { slug: 'trello', displayName: 'Trello', aliases: ['trello'] },
  { slug: 'jira', displayName: 'Jira', aliases: ['jira'] },
  { slug: 'dropbox', displayName: 'Dropbox', aliases: ['dropbox', 'drop box'] },
  { slug: 'asana', displayName: 'Asana', aliases: ['asana'] },
  { slug: 'linkedin', displayName: 'LinkedIn', aliases: ['linkedin', 'linked in'] },
]

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsAlias(haystack: string, alias: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias.toLowerCase())}([^a-z0-9]|$)`, 'i')
  return pattern.test(haystack)
}

function detectDraftIntegrations(text: string): KnownIntegration[] {
  const normalized = text.toLowerCase()
  return KNOWN_INTEGRATIONS.filter((integration) =>
    integration.aliases.some((alias) => containsAlias(normalized, alias)),
  )
}

function sentenceCase(value: string): string {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function clip(value: string, max = 180): string {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trim()}…`
}

function inferTitle(userText: string, fallback: string): string {
  const cleaned = normalizeWhitespace(
    userText
      .replace(/^(please|can you|could you|help me|i want you to)\s+/i, '')
      .replace(/^(every|each)\s+/i, '')
      .replace(/\?+$/, ''),
  )
  if (!cleaned) return fallback
  const base = cleaned.split(/[.!\n]/)[0] ?? cleaned
  const titled = sentenceCase(base)
  return titled.length > 72 ? `${titled.slice(0, 69).trim()}...` : titled
}

function inferSchedule(userText: string): {
  kind: AutomationScheduleKind
  label: string
  config: AutomationScheduleConfig
} | undefined {
  const text = userText.toLowerCase()
  if (/\bevery day\b|\bdaily\b|\beach day\b/.test(text)) {
    return { kind: 'daily', label: 'Every day at 9:00', config: { localTime: '09:00' } }
  }
  if (/\bweekdays\b|\bevery weekday\b/.test(text)) {
    return { kind: 'weekdays', label: 'Weekdays at 9:00', config: { localTime: '09:00' } }
  }
  if (/\bevery week\b|\bweekly\b/.test(text)) {
    return {
      kind: 'weekly',
      label: 'Mon, Wed, Fri at 9:00',
      config: { localTime: '09:00', weekdays: [1, 3, 5] },
    }
  }
  if (/\bevery month\b|\bmonthly\b/.test(text)) {
    return { kind: 'monthly', label: 'Day 1 of each month at 9:00', config: { localTime: '09:00', dayOfMonth: 1 } }
  }
  return undefined
}

export function shouldSuggestAutomationFromTurn(input: {
  userText: string
  assistantText?: string
  toolNames?: string[]
  recentUserTexts?: string[]
}): ChatAutomationSuggestionSummary | null {
  const userText = normalizeWhitespace(input.userText).toLowerCase()
  if (!userText) return null

  const repeatedRecentIntent =
    (input.recentUserTexts ?? [])
      .map((item) => normalizeWhitespace(item).toLowerCase())
      .filter(Boolean)
      .some((text) => text === userText)

  const toolCount = new Set((input.toolNames ?? []).filter(Boolean)).size
  const hasRecurringLanguage = /\b(every|each|daily|weekly|monthly|recurring|repeat|schedule|automatically)\b/.test(userText)
  const hasWorkflowLanguage = /\b(when|after|then|follow up|post to|send to|save to|check|monitor|sync|update)\b/.test(userText)

  if (hasRecurringLanguage && (hasWorkflowLanguage || toolCount >= 1)) {
    return {
      kind: 'automation',
      reason: 'This looks like a repeatable task with explicit recurrence language.',
      confidence: 'high',
    }
  }

  if (toolCount >= 2 && (hasWorkflowLanguage || repeatedRecentIntent)) {
    return {
      kind: repeatedRecentIntent ? 'automation' : 'skill',
      reason: repeatedRecentIntent
        ? 'This workflow appears repeated across turns and is a strong automation candidate.'
        : 'This turn used multiple connected steps and looks reusable as a saved skill.',
      confidence: repeatedRecentIntent ? 'high' : 'medium',
    }
  }

  if (/\btemplate|standardize|reuse|same thing\b/.test(userText)) {
    return {
      kind: 'skill',
      reason: 'The request reads like a reusable procedure rather than a one-off reply.',
      confidence: 'medium',
    }
  }

  return null
}

export function buildAutomationDraftFromTurn(input: {
  userText: string
  assistantText?: string
  toolNames?: string[]
  mode?: AutomationMode
  modelId?: string
  reason?: string
}): AutomationDraftSummary {
  const title = inferTitle(input.userText, 'Automation Draft')
  const detectedIntegrations = detectDraftIntegrations(
    [input.userText, input.assistantText].filter(Boolean).join('\n'),
  ).map((item) => item.displayName)
  const suggestedSchedule = inferSchedule(input.userText)
  const summary = clip(input.assistantText || input.userText, 180)
  const instructionsMarkdown = [
    `Goal: ${summary || title}`,
    '',
    'Steps:',
    `1. Review the latest context for "${title}".`,
    '2. Execute the required connected-app or knowledge steps.',
    '3. Return a concise result summary with any blockers or follow-ups.',
  ].join('\n')

  return {
    title,
    description: clip(sentenceCase(input.reason || 'Repeat this workflow automatically.'), 120),
    mode: input.mode ?? 'act',
    modelId: input.modelId ?? DEFAULT_AUTOMATION_DRAFT_MODEL_ID,
    instructionsMarkdown,
    detectedIntegrations,
    suggestedSchedule,
    confidence: suggestedSchedule ? 'high' : detectedIntegrations.length > 0 ? 'medium' : 'low',
    reason:
      input.reason ||
      (suggestedSchedule
        ? 'The request contains scheduling language and a repeatable multi-step workflow.'
        : 'The request looks like a repeatable operational workflow.'),
  }
}

export function buildSkillDraftFromTurn(input: {
  userText: string
  assistantText?: string
  reason?: string
}): SkillDraftSummary {
  const name = inferTitle(input.userText, 'Saved Skill')
  const detectedIntegrations = detectDraftIntegrations(
    [input.userText, input.assistantText].filter(Boolean).join('\n'),
  ).map((item) => item.displayName)
  return {
    name,
    description: clip(sentenceCase(input.reason || 'Reusable workflow from chat.'), 120),
    instructions: [
      `When the user asks for "${name}", apply this workflow:`,
      '',
      clip(input.assistantText || input.userText, 500),
      '',
      'Respond with what you completed and anything that still needs attention.',
    ].join('\n'),
    detectedIntegrations,
    confidence: detectedIntegrations.length > 0 ? 'medium' : 'low',
    reason: input.reason || 'This looks like a reusable multi-step procedure.',
  }
}
