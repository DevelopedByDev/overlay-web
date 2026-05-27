import test from 'node:test'
import assert from 'node:assert/strict'
import type { ToolSet } from 'ai'

test('createBrowserUnifiedTools requests the DEFAULT GITHUB_* tools via tools.get when enabledGithubToolSlugs is undefined', async () => {
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
test('default GitHub toolset excludes allowlist-bypassing slugs', async () => {
  const { createBrowserUnifiedTools, DEFAULT_GITHUB_TOOL_SLUGS } = await import(
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
  assert.ok(
    !requested.includes('GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER'),
    'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER must be removed — it enumerates non-allowlisted repos',
  )
  // After Fix 1 + Fix 2 the default list is exactly 9 slugs — also pin against
  // the exported constant so the test and impl can't drift independently.
  assert.equal(
    requested.length,
    9,
    `expected exactly 9 default read-only GitHub slugs after security pruning, got ${requested.length}: ${requested.join(', ')}`,
  )
  assert.equal(
    (DEFAULT_GITHUB_TOOL_SLUGS as readonly string[]).length,
    9,
    'DEFAULT_GITHUB_TOOL_SLUGS itself must contain exactly 9 slugs',
  )
})

test('createBrowserUnifiedTools with an explicit single-slug enabled list passes only that slug to tools.get', async () => {
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
    enabledGithubToolSlugs: ['GITHUB_GET_AN_ISSUE'],
  })

  assert.deepEqual(
    receivedFilters?.tools,
    ['GITHUB_GET_AN_ISSUE'],
    'expected tools.get to receive exactly the explicit slug list — no defaults inserted',
  )
})

test('createBrowserUnifiedTools with an empty enabled list short-circuits and does not call tools.get', async () => {
  const { createBrowserUnifiedTools } = await import(
    new URL('./composio-tools.ts', import.meta.url).href,
  )

  let toolsGetCalled = false
  const stubComposio = {
    create: async () => {
      throw new Error('should not be called')
    },
    tools: {
      get: async () => {
        toolsGetCalled = true
        return {} as ToolSet
      },
    },
  }

  const result = await createBrowserUnifiedTools({
    userId: 'test-user',
    projectId: 'test-project',
    composio: stubComposio,
    enabledGithubToolSlugs: [],
  })

  assert.equal(
    toolsGetCalled,
    false,
    'composio.tools.get must NOT be called when the enabled list is empty',
  )
  assert.deepEqual(
    result,
    {},
    'expected an empty ToolSet when no github tools are enabled',
  )
})

test('createBrowserUnifiedTools filters hard-denied slugs from an explicit enabled list', async () => {
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
    enabledGithubToolSlugs: [
      'GITHUB_DELETE_A_REPOSITORY',
      'GITHUB_GET_AN_ISSUE',
    ],
  })

  assert.deepEqual(
    receivedFilters?.tools,
    ['GITHUB_GET_AN_ISSUE'],
    'expected hard-denied slug GITHUB_DELETE_A_REPOSITORY to be filtered out before tools.get',
  )
})
