import test from 'node:test'
import assert from 'node:assert/strict'
import type { ToolSet } from 'ai'

test('createBrowserUnifiedTools requests the curated GITHUB_* tools via tools.get', async () => {
  const { createBrowserUnifiedTools } = await import(
    new URL('./composio-tools.ts', import.meta.url).href,
  )

  let receivedFilters: { tools?: string[]; toolkits?: string[] } | undefined
  const fakeToolSet: ToolSet = {
    GITHUB_GET_A_REPOSITORY: {
      description: 'Get a repo',
      execute: async () => ({ ok: true }),
    } as unknown as ToolSet[string],
    GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: {
      description: 'List repos',
      execute: async () => ({ ok: true, items: [] }),
    } as unknown as ToolSet[string],
  }

  const stubComposio = {
    // create is the old path — should NOT be called after the swap.
    create: async () => {
      throw new Error(
        'Task 3 regression: composio.create() should not be called after the swap',
      )
    },
    tools: {
      get: async (
        _entityId: string,
        filters: { tools?: string[]; toolkits?: string[] },
      ) => {
        receivedFilters = filters
        return fakeToolSet
      },
    },
  }

  const tools = await createBrowserUnifiedTools({
    userId: 'test-user',
    projectId: 'test-project',
    composio: stubComposio,
  })

  assert.ok(
    receivedFilters?.tools,
    'expected tools.get to be called with { tools: [...] }',
  )
  assert.ok(
    (receivedFilters.tools ?? []).length > 0,
    'expected at least one tool slug requested',
  )
  // All requested slugs must start with GITHUB_ (no other toolkits in scope).
  for (const slug of receivedFilters.tools ?? []) {
    assert.match(slug, /^GITHUB_/, `requested non-github slug: ${slug}`)
  }
  // Returned ToolSet must include the keys our stub returned.
  const keys = Object.keys(tools)
  const githubKeys = keys.filter((k) => k.startsWith('GITHUB_'))
  assert.ok(
    githubKeys.length >= 2,
    `expected >=2 GITHUB_* keys in result, got: ${keys.join(', ')}`,
  )
})

// SECURITY (P0): GITHUB_SEARCH_CODE allows freeform `q` query modifiers
// (e.g. `q='secret repo:victim/private'`) that the allowlist wrap CANNOT
// validate — the wrap's extractor inspects structured args, not freeform
// query strings. A model can search code in non-allowlisted repos via the
// `q` parameter. Until Phase B adds a `q`-aware wrap, the slug must remain
// absent from the curated list.
//
// SECURITY (P1): GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER returns
// the full list of repos visible to the connected GitHub account (including
// private repos in any org). The wrap has no repo args to validate against —
// the extractor returns null and the call passes through. Discovery of
// allowlist-eligible repos already flows through the project-scoped
// /api/app/integrations/github/repositories endpoint.
test('curated GitHub toolset excludes allowlist-bypassing slugs', async () => {
  const { createBrowserUnifiedTools } = await import(
    new URL('./composio-tools.ts', import.meta.url).href,
  )

  let receivedFilters: { tools?: string[]; toolkits?: string[] } | undefined
  const stubComposio = {
    create: async () => {
      throw new Error('should not be called')
    },
    tools: {
      get: async (
        _entityId: string,
        filters: { tools?: string[]; toolkits?: string[] },
      ) => {
        receivedFilters = filters
        return {} as ToolSet
      },
    },
  }

  await createBrowserUnifiedTools({
    userId: 'test-user',
    projectId: 'test-project',
    composio: stubComposio,
  })

  const requested = receivedFilters?.tools ?? []
  assert.ok(
    !requested.includes('GITHUB_SEARCH_CODE'),
    'GITHUB_SEARCH_CODE must be removed — its `q` query string can target non-allowlisted repos via `repo:` modifiers',
  )
  // After Fix 1 (SEARCH_CODE removal) the curated list is exactly 10 slugs.
  assert.equal(
    requested.length,
    10,
    `expected exactly 10 curated read-only GitHub slugs after dropping GITHUB_SEARCH_CODE, got ${requested.length}: ${requested.join(', ')}`,
  )
})
