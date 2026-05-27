import test from 'node:test'
import assert from 'node:assert/strict'

test('humanizeSlug strips GITHUB_ prefix and capitalizes', async () => {
  const { humanizeSlug } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  assert.equal(humanizeSlug('GITHUB_GET_AN_ISSUE'), 'Get an issue')
  assert.equal(humanizeSlug('GITHUB_LIST_PULL_REQUESTS'), 'List pull requests')
  assert.equal(humanizeSlug('GITHUB_GET_A_REPOSITORY_README'), 'Get a repository readme')
  // Slugs without GITHUB_ prefix still get cased.
  assert.equal(humanizeSlug('SOME_OTHER_TOOL'), 'Some other tool')
  // Empty / pathological inputs degrade gracefully (no exceptions).
  assert.equal(humanizeSlug(''), '')
  assert.equal(humanizeSlug('GITHUB_'), '')
})

test('classifyCatalogFetchError routes status + message cues to the right code', async () => {
  const { classifyCatalogFetchError } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  assert.deepEqual(classifyCatalogFetchError({ status: 429 }), { error: 'rate_limited' })
  assert.deepEqual(classifyCatalogFetchError({ status: 401 }), { error: 'github_not_connected' })
  assert.deepEqual(classifyCatalogFetchError({ status: 403 }), { error: 'github_not_connected' })
  // Walks the cause chain to find the wrapped HTTP status (ComposioToolExecutionError pattern).
  assert.deepEqual(
    classifyCatalogFetchError({ cause: { status: 429 } }),
    { error: 'rate_limited' },
  )
  // Falls back to message-text heuristics when no status is exposed.
  assert.deepEqual(
    classifyCatalogFetchError(new Error('No active connection found for toolkit github')),
    { error: 'github_not_connected' },
  )
  assert.deepEqual(
    classifyCatalogFetchError(new Error('ActionExecute_ConnectedAccountEntityIdRequired')),
    { error: 'github_not_connected' },
  )
  assert.deepEqual(
    classifyCatalogFetchError(new Error('rate-limited by upstream')),
    { error: 'rate_limited' },
  )
  // Unknown shapes default to fetch_failed.
  assert.deepEqual(classifyCatalogFetchError(new Error('boom')), { error: 'fetch_failed' })
  assert.deepEqual(classifyCatalogFetchError({ status: 500 }), { error: 'fetch_failed' })
})

test('buildCatalogItems maps, falls back, categorizes, and sorts', async () => {
  const { buildCatalogItems } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  // Catalog ordering intentionally NOT alphabetical so we can verify the sort.
  const catalog = {
    GITHUB_LIST_PULL_REQUESTS: {
      name: 'List pull requests',
      description: 'Lists PRs in a repo.',
    },
    GITHUB_GET_AN_ISSUE: {
      // No name field — should fall back to humanizeSlug.
      description: 'Returns the specified issue.',
    },
    GITHUB_DELETE_A_REPOSITORY: {
      name: 'Delete a repository',
      description: 'Deletes the repo (admin).',
    },
  }

  const items = buildCatalogItems(catalog)

  assert.equal(items.length, 3)
  // Sorted by slug.
  assert.equal(items[0].slug, 'GITHUB_DELETE_A_REPOSITORY')
  assert.equal(items[1].slug, 'GITHUB_GET_AN_ISSUE')
  assert.equal(items[2].slug, 'GITHUB_LIST_PULL_REQUESTS')
  // Name fallback worked.
  assert.equal(items[1].name, 'Get an issue')
  // Provided name passed through.
  assert.equal(items[2].name, 'List pull requests')
  // Categories assigned via the shared heuristic.
  assert.equal(items[0].category, 'Repositories')
  assert.equal(items[1].category, 'Issues')
  assert.equal(items[2].category, 'Pull Requests')
  // Description always a string.
  assert.equal(typeof items[0].description, 'string')
})

test('fetchGithubToolsCatalog: happy path returns sorted items', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  let receivedFilters: { toolkits?: string[] } | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let receivedOptions: any
  const composio = {
    tools: {
      get: async (
        _entityId: string,
        filters: { toolkits?: string[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options?: any,
      ) => {
        receivedFilters = filters
        receivedOptions = options
        return {
          GITHUB_GET_AN_ISSUE: { description: 'Get an issue' },
          GITHUB_GET_A_REPOSITORY: { name: 'Get a repository', description: 'Repo metadata' },
          GITHUB_DELETE_A_REPOSITORY: { description: 'Deletes the repo' },
        }
      },
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'user_123/project_abc', composio })

  assert.ok('items' in result, `expected items in result, got ${JSON.stringify(result)}`)
  if (!('items' in result)) return

  assert.deepEqual(receivedFilters, { toolkits: ['github'] })
  assert.equal(receivedOptions?.limit, 500)
  assert.equal(result.items.length, 3)
  // Sorted.
  assert.equal(result.items[0].slug, 'GITHUB_DELETE_A_REPOSITORY')
  assert.equal(result.items[1].slug, 'GITHUB_GET_AN_ISSUE')
  assert.equal(result.items[2].slug, 'GITHUB_GET_A_REPOSITORY')
})

test('fetchGithubToolsCatalog: empty catalog → github_not_connected', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  const composio = {
    tools: {
      get: async () => ({}),
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'entity_x', composio })
  assert.deepEqual(result, { error: 'github_not_connected' })
})

test('fetchGithubToolsCatalog: ConnectedAccountEntityIdRequired throw → github_not_connected', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  const composio = {
    tools: {
      get: async () => {
        throw new Error('ActionExecute_ConnectedAccountEntityIdRequired')
      },
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'entity_x', composio })
  assert.deepEqual(result, { error: 'github_not_connected' })
})

test('fetchGithubToolsCatalog: 429 in cause chain → rate_limited', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  const composio = {
    tools: {
      get: async () => {
        const err = new Error('upstream throttled') as Error & { cause?: { status?: number } }
        err.cause = { status: 429 }
        throw err
      },
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'entity_x', composio })
  assert.deepEqual(result, { error: 'rate_limited' })
})

test('fetchGithubToolsCatalog: generic throw → fetch_failed', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )

  const composio = {
    tools: {
      get: async () => {
        throw new Error('boom')
      },
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'entity_x', composio })
  assert.deepEqual(result, { error: 'fetch_failed' })
})

test('fetchGithubToolsCatalog: hard-denied slugs still appear in items (UI greys them out)', async () => {
  const { fetchGithubToolsCatalog } = await import(
    new URL('./github-tools-catalog.ts', import.meta.url).href,
  )
  const { isHardDeniedGithubTool } = await import(
    new URL('../tools/github-tools-hard-deny.ts', import.meta.url).href,
  )

  const composio = {
    tools: {
      get: async () => ({
        GITHUB_GET_AN_ISSUE: { description: 'read' },
        GITHUB_DELETE_A_REPOSITORY: { description: 'destructive' },
        GITHUB_UPDATE_A_REPOSITORY_SECRET: { description: 'secret write' },
      }),
    },
  }

  const result = await fetchGithubToolsCatalog({ entityId: 'entity_x', composio })
  assert.ok('items' in result)
  if (!('items' in result)) return

  // All three slugs returned — the route layer applies hard-deny resolution
  // to populate the response's `hardDenied` field; the catalog stays full.
  const slugs = result.items.map((item: { slug: string }) => item.slug)
  assert.ok(slugs.includes('GITHUB_GET_AN_ISSUE'))
  assert.ok(slugs.includes('GITHUB_DELETE_A_REPOSITORY'))
  assert.ok(slugs.includes('GITHUB_UPDATE_A_REPOSITORY_SECRET'))

  // Sanity: the route layer's hard-deny resolution against this list yields
  // both denied slugs.
  const hardDenied = slugs.filter(isHardDeniedGithubTool)
  assert.deepEqual(hardDenied.sort(), [
    'GITHUB_DELETE_A_REPOSITORY',
    'GITHUB_UPDATE_A_REPOSITORY_SECRET',
  ])
})
