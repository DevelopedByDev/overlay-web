import type { ToolSet } from 'ai'

/**
 * Composio tool set (full). Free-tier filtering uses filterComposioToolSetForPaidOnlyFeatures.
 */
export function filterComposioToolSet(toolSet: ToolSet): ToolSet {
  return toolSet
}

/** Substrings in Composio tool names that indicate browser / automation (paid only). */
const PAID_ONLY_COMPOSIO_NAME_HINTS = ['BROWSER', 'PLAYWRIGHT', 'PUPPETEER'] as const

/**
 * Remove Composio tools that are browser-automation / heavy remote UI (free tier: integrations only, no remote browser).
 */
export function filterComposioToolSetForPaidOnlyFeatures(
  toolSet: ToolSet,
  includePaidOnlyFeatures: boolean,
): ToolSet {
  if (includePaidOnlyFeatures) return toolSet
  const out: ToolSet = {}
  for (const [name, def] of Object.entries(toolSet)) {
    if (!def || typeof def !== 'object') continue
    const u = name.toUpperCase()
    if (PAID_ONLY_COMPOSIO_NAME_HINTS.some((h) => u.includes(h))) continue
    out[name] = def
  }
  return out
}
