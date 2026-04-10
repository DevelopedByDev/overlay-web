import { convex } from './convex'
import { getInternalApiSecret } from './internal-api-secret'
import { isPremiumModel } from './model-pricing'
import { getServerProviderKey } from './server-provider-keys'
import { getAutomationExecutorBaseUrl } from './url'
import type { AutomationSummary } from './automations'

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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsAlias(haystack: string, alias: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias.toLowerCase())}([^a-z0-9]|$)`, 'i')
  return pattern.test(haystack)
}

export function detectRequiredIntegrations(text: string): KnownIntegration[] {
  const normalized = text.toLowerCase()
  return KNOWN_INTEGRATIONS.filter((integration) =>
    integration.aliases.some((alias) => containsAlias(normalized, alias)),
  )
}

async function getComposioApiKey(): Promise<string | null> {
  return (await getServerProviderKey('composio')) ?? process.env.COMPOSIO_API_KEY?.trim() ?? null
}

async function listConnectedIntegrationSlugs(userId: string): Promise<Set<string> | null> {
  const apiKey = await getComposioApiKey()
  if (!apiKey) return null

  const response = await fetch(
    `https://backend.composio.dev/api/v1/connectedAccounts?entityId=${encodeURIComponent(userId)}&page=1&pageSize=100`,
    { headers: { 'x-api-key': apiKey } },
  )
  if (!response.ok) {
    throw new Error(`Failed to list connected integrations (${response.status})`)
  }

  const data = (await response.json()) as {
    items?: Array<{ appName?: string }>
  }

  return new Set(
    (data.items ?? [])
      .map((item) => item.appName?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  )
}

export async function runAutomationIntegrationPreflight(args: {
  automation: AutomationSummary
  sourceInstructions: string
  userId: string
}): Promise<
  | {
      ok: true
      requiredIntegrations: KnownIntegration[]
      missingIntegrations: KnownIntegration[]
    }
  | {
      ok: false
      errorCode:
        | 'integration_provider_unavailable'
        | 'missing_integrations'
        | 'invalid_source'
        | 'model_not_allowed'
        | 'executor_unavailable'
      errorMessage: string
      requiredIntegrations: KnownIntegration[]
      missingIntegrations: KnownIntegration[]
    }
> {
  if (!args.sourceInstructions.trim()) {
    return {
      ok: false,
      errorCode: 'invalid_source',
      errorMessage: 'This automation has no executable instructions. Update the source before running it.',
      requiredIntegrations: [],
      missingIntegrations: [],
    }
  }

  const executorBaseUrl = getAutomationExecutorBaseUrl()
  if (!executorBaseUrl) {
    return {
      ok: false,
      errorCode: 'executor_unavailable',
      errorMessage: 'The automation executor is not configured on the server.',
      requiredIntegrations: [],
      missingIntegrations: [],
    }
  }

  let serverSecret: string
  try {
    serverSecret = getInternalApiSecret()
  } catch {
    return {
      ok: false,
      errorCode: 'executor_unavailable',
      errorMessage: 'The automation executor server secret is not configured.',
      requiredIntegrations: [],
      missingIntegrations: [],
    }
  }
  const entitlements = (await convex.query(
    'usage:getEntitlementsByServer',
    {
      userId: args.userId,
      serverSecret,
    },
    { throwOnError: true },
  )) as {
    tier: 'free' | 'pro' | 'max'
    creditsUsed: number
    creditsTotal: number
  } | null
  if (!entitlements) {
    return {
      ok: false,
      errorCode: 'model_not_allowed',
      errorMessage: 'Could not verify account entitlements for this automation.',
      requiredIntegrations: [],
      missingIntegrations: [],
    }
  }
  if (entitlements.tier === 'free' && isPremiumModel(args.automation.modelId)) {
    return {
      ok: false,
      errorCode: 'model_not_allowed',
      errorMessage: 'This automation uses a premium model, but the account is on the free tier.',
      requiredIntegrations: [],
      missingIntegrations: [],
    }
  }

  const searchableText = [
    args.automation.title,
    args.automation.description,
    args.sourceInstructions,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')

  const requiredIntegrations = detectRequiredIntegrations(searchableText)
  if (!requiredIntegrations.length) {
    return { ok: true, requiredIntegrations, missingIntegrations: [] }
  }

  const connectedIntegrations = await listConnectedIntegrationSlugs(args.userId)
  if (!connectedIntegrations) {
    return {
      ok: false,
      errorCode: 'integration_provider_unavailable',
      errorMessage:
        'This automation references connected integrations, but the integration provider is not configured on the server.',
      requiredIntegrations,
      missingIntegrations: requiredIntegrations,
    }
  }

  const missingIntegrations = requiredIntegrations.filter(
    (integration) => !connectedIntegrations.has(integration.slug),
  )
  if (!missingIntegrations.length) {
    return { ok: true, requiredIntegrations, missingIntegrations }
  }

  return {
    ok: false,
    errorCode: 'missing_integrations',
    errorMessage: `This automation requires connected integrations before it can run: ${missingIntegrations
      .map((integration) => integration.displayName)
      .join(', ')}. Connect them in Integrations and retry.`,
    requiredIntegrations,
    missingIntegrations,
  }
}
