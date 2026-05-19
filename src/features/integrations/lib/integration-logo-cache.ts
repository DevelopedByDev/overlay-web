/**
 * Shared client-side cache for Composio integration logo URLs.
 * Populated by IntegrationsView / ChatInterface and consumed by MarkdownMessage
 * when rendering integration connect cards in chat.
 */

const cache = new Map<string, string | null>()
let inflight: Promise<void> | null = null

/** Map normalized service names to Composio slugs. */
const NAME_TO_SLUG: Record<string, string> = {
  'gmail': 'gmail',
  'google calendar': 'googlecalendar',
  'google sheets': 'googlesheets',
  'google drive': 'googledrive',
  'google meet': 'googlemeet',
  'notion': 'notion',
  'outlook': 'outlook',
  'x (twitter)': 'twitter',
  'twitter': 'twitter',
  'asana': 'asana',
  'linkedin': 'linkedin',
  'github': 'github',
  'slack': 'slack',
  'discord': 'discord',
  'dropbox': 'dropbox',
  'zoom': 'zoom',
  'jira': 'jira',
  'trello': 'trello',
  'salesforce': 'salesforce',
  'hubspot': 'hubspot',
  'airtable': 'airtable',
  'cal.com': 'calcom',
  'calcom': 'calcom',
  'linear': 'linear',
  'microsoft excel': 'excel',
  'excel': 'excel',
  'microsoft word': 'word',
  'word': 'word',
  'microsoft powerpoint': 'powerpoint',
  'powerpoint': 'powerpoint',
  'microsoft teams': 'msteams',
  'teams': 'msteams',
  'onedrive': 'onedrive',
  'sharepoint': 'sharepoint',
  'instagram': 'instagram',
  'instagram business': 'instagram',
  'facebook': 'facebook',
  'whatsapp': 'whatsapp',
  'whatsapp business': 'whatsapp',
  'youtube': 'youtube',
  'tiktok': 'tiktok',
  'pinterest': 'pinterest',
  'reddit': 'reddit',
  'stripe': 'stripe',
  'shopify': 'shopify',
  'woocommerce': 'woocommerce',
  'wordpress': 'wordpress',
  'telegram': 'telegram',
  'spotify': 'spotify',
  'netflix': 'netflix',
  'twitch': 'twitch',
  'paypal': 'paypal',
  'square': 'square',
  'quickbooks': 'quickbooks',
  'freshbooks': 'freshbooks',
  'zapier': 'zapier',
  'make': 'make',
  'n8n': 'n8n',
  'clickup': 'clickup',
  'monday.com': 'monday',
  'monday': 'monday',
  'basecamp': 'basecamp',
  'gitlab': 'gitlab',
  'bitbucket': 'bitbucket',
  'docker': 'docker',
  'aws': 'aws',
  'google cloud': 'googlecloud',
  'azure': 'azure',
  'heroku': 'heroku',
  'vercel': 'vercel',
  'cloudflare': 'cloudflare',
  'digitalocean': 'digitalocean',
  'mongodb': 'mongodb',
  'firebase': 'firebase',
  'supabase': 'supabase',
  'planetscale': 'planetscale',
  'neon': 'neon',
  'turso': 'turso',
  'prisma': 'prisma',
}

export function resolveSlugFromName(name: string): string | null {
  const normalized = name.toLowerCase().trim()
  return NAME_TO_SLUG[normalized] ?? null
}

export function getIntegrationLogoUrl(slug: string): string | null {
  return cache.get(slug) ?? null
}

export function setIntegrationLogoUrl(slug: string, url: string | null): void {
  cache.set(slug, url)
}

export function hasIntegrationLogo(slug: string): boolean {
  return cache.has(slug)
}

export async function warmIntegrationLogoCache(): Promise<void> {
  if (inflight) return inflight
  if (cache.size > 0) return

  inflight = (async () => {
    try {
      const res = await fetch('/api/app/integrations?action=search&limit=100')
      if (!res.ok) return
      const data = (await res.json()) as { items?: Array<{ slug: string; logoUrl?: string | null }> }
      const items = Array.isArray(data?.items) ? data.items : []
      for (const item of items) {
        if (item.slug) {
          cache.set(item.slug, item.logoUrl ?? null)
        }
      }
    } catch {
      // silent fail
    } finally {
      inflight = null
    }
  })()

  return inflight
}
