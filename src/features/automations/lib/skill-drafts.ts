export interface SkillDraftSummary {
  name: string
  description: string
  instructions: string
  detectedIntegrations: string[]
  confidence: 'low' | 'medium' | 'high'
  reason: string
}

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
