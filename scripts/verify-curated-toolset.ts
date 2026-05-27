// scripts/verify-curated-toolset.ts
/**
 * Verification of the Phase 4 swap.
 *
 * Hits live Composio with the EXACT entity ID + tool list that the chat route's
 * `createBrowserUnifiedTools` would use. Cannot import `createBrowserUnifiedTools`
 * directly (it's marked `'server-only'` and that breaks node/tsx runtimes), so
 * we re-call its inner SDK call with the same arguments.
 *
 * Run via: pnpm tsx scripts/verify-curated-toolset.ts
 *
 * Requires env:
 *   COMPOSIO_API_KEY              — strip surrounding quotes if .env.local quotes
 *   VERIFY_USER_ID                — defaults to dev userId from this session
 *   VERIFY_PROJECT_ID             — defaults to Reliance Financial projectId
 */
import { Composio } from '@composio/core'
import { VercelProvider } from '@composio/vercel'
import { projectComposioEntityId } from '../src/server/tools/composio-entity'

// Must match CHAT_GITHUB_READONLY_TOOL_SLUGS in src/server/tools/composio-tools.ts
const CURATED: readonly string[] = [
  'GITHUB_GET_A_REPOSITORY',
  // GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER removed (security/P1):
  // enumerates non-allowlisted repos.
  'GITHUB_GET_REPOSITORY_CONTENT',
  'GITHUB_GET_A_REPOSITORY_README',
  'GITHUB_LIST_COMMITS',
  'GITHUB_GET_A_COMMIT',
  'GITHUB_LIST_REPOSITORY_ISSUES',
  'GITHUB_GET_AN_ISSUE',
  'GITHUB_LIST_PULL_REQUESTS',
  'GITHUB_GET_A_PULL_REQUEST',
  // GITHUB_SEARCH_CODE removed (security/P0): `q` modifiers bypass the allowlist.
]

const apiKey: string | undefined = process.env.COMPOSIO_API_KEY?.replace(/^"|"$/g, '')
const userId: string = process.env.VERIFY_USER_ID ?? 'user_01K75Z8N3FK5TD9CD116HHP87A'
const projectId: string = process.env.VERIFY_PROJECT_ID ?? 'mh715nq1eaep590qkzhn4drm3x871s9a'

if (!apiKey) {
  console.error('Missing COMPOSIO_API_KEY')
  process.exit(1)
}

const entityId = projectComposioEntityId(userId, projectId)

async function main() {
  const composio = new Composio({ apiKey: apiKey!, provider: new VercelProvider() })
  console.log('[verify] entity:', entityId)
  console.log('[verify] calling composio.tools.get with curated list of', CURATED.length, 'slugs...')

  const toolSet = (await composio.tools.get(entityId, {
    tools: [...CURATED],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as Record<string, { execute?: (input: any) => Promise<unknown> }>

  const keys = Object.keys(toolSet).sort()
  console.log('[verify] returned keys count:', keys.length)
  console.log('[verify] returned keys:', keys)
  const missing = CURATED.filter((c) => !keys.includes(c))
  const extra = keys.filter((k) => !(CURATED as readonly string[]).includes(k))
  console.log('[verify] missing from curated:', missing)
  console.log('[verify] extra not in curated:', extra)
  console.log('[verify] all-GITHUB-prefixed?', keys.every((k) => k.startsWith('GITHUB_')))
  console.log('[verify] all have execute()?', keys.every((k) => typeof toolSet[k]?.execute === 'function'))

  // Smoke an actual call against the project's allowed repo so we know the
  // VercelProvider auto-bound the connected account.
  const repoTool = toolSet['GITHUB_GET_A_REPOSITORY']
  if (!repoTool?.execute) {
    console.error('[verify] FAIL: GITHUB_GET_A_REPOSITORY missing')
    process.exit(2)
  }
  console.log('[verify] executing GITHUB_GET_A_REPOSITORY against dusseauand/reliance_underwriting_system ...')
  try {
    const result = await repoTool.execute({ owner: 'dusseauand', repo: 'reliance_underwriting_system' })
    console.log('[verify] execute success. first 200 chars:', JSON.stringify(result).slice(0, 200))
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.log('[verify] execute threw:', m.slice(0, 400))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cause = (e as any)?.cause
    if (cause) console.log('[verify]  cause:', JSON.stringify(cause).slice(0, 400))
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('UNCAUGHT:', err)
  process.exit(99)
})
