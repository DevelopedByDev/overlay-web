// scripts/composio-tools-smoke.ts
/**
 * One-shot smoke. Run via: pnpm tsx scripts/composio-tools-smoke.ts
 *
 * Requires env:
 *   COMPOSIO_API_KEY                — your Composio dev key
 *   COMPOSIO_SMOKE_ENTITY_ID        — entity with active github connection
 *
 * Validates:
 *   1. composio.tools.get returns Vercel-AI-SDK-compatible tools with execute().
 *   2. One of those tools can execute against a public github repo.
 *      Failure mode of interest: ActionExecute_ConnectedAccountEntityIdRequired.
 */
import { Composio } from '@composio/core'
import { VercelProvider } from '@composio/vercel'

const apiKey: string | undefined = process.env.COMPOSIO_API_KEY
const entityId: string | undefined = process.env.COMPOSIO_SMOKE_ENTITY_ID
if (!apiKey || !entityId) {
  console.error('Need COMPOSIO_API_KEY and COMPOSIO_SMOKE_ENTITY_ID env vars')
  process.exit(1)
}
// Narrow for TS — process.exit isn't typed as `never` in some @types/node versions.
const COMPOSIO_API_KEY: string = apiKey
const COMPOSIO_SMOKE_ENTITY_ID: string = entityId

const composio = new Composio({ apiKey: COMPOSIO_API_KEY, provider: new VercelProvider() })

async function main() {
  // Default `{ toolkits: ['github'] }` filter caps at 20 alphabetically and
  // misses GITHUB_GET_*/GITHUB_LIST_* — the exact tools chat needs. Verify
  // that raising `limit:` surfaces them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolset = (await composio.tools.get(COMPOSIO_SMOKE_ENTITY_ID, { toolkits: ['github'], limit: 500 })) as any
  const keys = Object.keys(toolset).sort()
  console.log('Returned tool count (toolkits=github, limit=500):', keys.length)
  console.log('First 20 keys:', keys.slice(0, 20))
  const getKeys = keys.filter((k) => k.startsWith('GITHUB_GET_'))
  const listKeys = keys.filter((k) => k.startsWith('GITHUB_LIST_'))
  console.log('GITHUB_GET_* count:', getKeys.length, 'examples:', getKeys.slice(0, 5))
  console.log('GITHUB_LIST_* count:', listKeys.length, 'examples:', listKeys.slice(0, 5))

  // Verify execute() against a public repo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const namedSet = (await composio.tools.get(COMPOSIO_SMOKE_ENTITY_ID, {
    tools: ['GITHUB_GET_A_REPOSITORY'],
  })) as any
  const namedKeys = Object.keys(namedSet)
  console.log('Named-fetch keys:', namedKeys)
  const repoTool = namedSet['GITHUB_GET_A_REPOSITORY']
  if (!repoTool?.execute) {
    console.error('GITHUB_GET_A_REPOSITORY tool not present or has no execute()')
    process.exit(2)
  }

  try {
    const result = await repoTool.execute({ owner: 'composiohq', repo: 'composio' })
    console.log('Tool execute result (first 400 chars):', JSON.stringify(result).slice(0, 400))
    process.exit(0)
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any
    console.error('Tool execute threw.')
    console.error('  message:', anyErr?.message ?? String(err))
    console.error('  cause.status:', anyErr?.cause?.status)
    console.error('  cause.error:', JSON.stringify(anyErr?.cause?.error).slice(0, 400))
    process.exit(3)
  }
}

main().catch((err) => {
  console.error('Unexpected top-level error:', err)
  process.exit(4)
})
