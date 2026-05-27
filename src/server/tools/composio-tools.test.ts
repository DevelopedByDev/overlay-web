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
