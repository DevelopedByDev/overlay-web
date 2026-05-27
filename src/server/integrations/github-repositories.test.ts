import test from 'node:test'
import assert from 'node:assert/strict'

test('findGithubConnectedAccountId selects active GitHub account variants', async () => {
  const { findGithubConnectedAccountId } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  assert.equal(
    findGithubConnectedAccountId([
      { id: 'conn_slack', appName: 'slack' },
      { id: 'conn_disabled', appName: 'github', isDisabled: true },
      { id: 'conn_inactive', appName: 'github', status: 'FAILED' },
      { id: 'conn_github', appName: 'GitHub', status: 'ACTIVE' },
    ]),
    'conn_github',
  )
  assert.equal(
    findGithubConnectedAccountId([{ id: 'conn_github', toolkit: { slug: 'github' } }]),
    'conn_github',
  )
  assert.equal(findGithubConnectedAccountId([{ appName: 'github' }]), null)
})

test('repository cursor and limit parsers default and clamp safely', async () => {
  const { parseGithubRepositoryLimit, parseGithubRepositoryPage } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  assert.equal(parseGithubRepositoryPage(null), 1)
  assert.equal(parseGithubRepositoryPage('4'), 4)
  assert.equal(parseGithubRepositoryPage('0'), 1)
  assert.equal(parseGithubRepositoryPage('abc'), 1)

  assert.equal(parseGithubRepositoryLimit(null), 100)
  assert.equal(parseGithubRepositoryLimit('25'), 25)
  assert.equal(parseGithubRepositoryLimit('500'), 200)
  assert.equal(parseGithubRepositoryLimit('0'), 100)
  assert.equal(parseGithubRepositoryLimit('abc'), 100)
})

test('repository mapper preserves full names and visibility flags', async () => {
  const { mapGithubRepositoryListItems } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  assert.deepEqual(
    mapGithubRepositoryListItems([
      { full_name: 'Acme/Web', private: true, archived: false },
      { name: 'Api', owner: { login: 'Acme' }, visibility: 'public', archived: true },
      { name: 'missing-owner' },
    ]),
    [
      { fullName: 'acme/web', private: true, archived: false },
      { fullName: 'acme/api', private: false, archived: true },
    ],
  )
})

test('next cursor parser prefers GitHub Link rel=next page', async () => {
  const { parseNextCursorFromLinkHeader } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  const link =
    '<https://api.github.com/user/repos?visibility=all&page=2&per_page=100>; rel="next", ' +
    '<https://api.github.com/user/repos?visibility=all&page=9&per_page=100>; rel="last"'
  assert.equal(parseNextCursorFromLinkHeader(link), '2')
  assert.equal(parseNextCursorFromLinkHeader('<https://api.github.com/user/repos?page=9>; rel="last"'), null)
})

test('repository response builder computes cursor from Link header or full page fallback', async () => {
  const { buildGithubRepositoryListResponse } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  const repos = Array.from({ length: 2 }, (_, index) => ({
    full_name: `acme/repo-${index}`,
    private: false,
  }))

  assert.deepEqual(
    buildGithubRepositoryListResponse(
      {
        status: 200,
        data: repos,
        headers: {
          Link: '<https://api.github.com/user/repos?page=7&per_page=2>; rel="next"',
        },
      },
      { limit: 2, page: 1 },
    ),
    {
      items: [
        { fullName: 'acme/repo-0', private: false },
        { fullName: 'acme/repo-1', private: false },
      ],
      nextCursor: '7',
    },
  )

  assert.equal(
    buildGithubRepositoryListResponse({ status: 200, data: repos, headers: {} }, { limit: 2, page: 3 }).nextCursor,
    '4',
  )
  assert.equal(
    buildGithubRepositoryListResponse({ status: 200, data: repos.slice(0, 1), headers: {} }, { limit: 2, page: 3 }).nextCursor,
    null,
  )
})

test('repository proxy failures classify auth, rate limit, and generic failures', async () => {
  const { classifyGithubRepositoryProxyFailure } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  assert.equal(classifyGithubRepositoryProxyFailure({ status: 401, data: { message: 'Bad credentials' } }), 'github_not_connected')
  assert.equal(classifyGithubRepositoryProxyFailure({ status: 403, data: { message: 'API rate limit exceeded' } }), 'rate_limited')
  assert.equal(classifyGithubRepositoryProxyFailure(new Error('No active connection found for toolkit github')), 'github_not_connected')
  assert.equal(classifyGithubRepositoryProxyFailure({ status: 429 }), 'rate_limited')
  assert.equal(classifyGithubRepositoryProxyFailure({ status: 500 }), 'fetch_failed')
})

test('isGithubRepositoryToolSuccess recognizes tool-execute and proxy shapes', async () => {
  const { isGithubRepositoryToolSuccess } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  // Tool-execute envelope shape from composio.tools.execute
  assert.equal(isGithubRepositoryToolSuccess({ successful: true, data: [] }), true)
  assert.equal(isGithubRepositoryToolSuccess({ successful: false, error: 'boom' }), false)
  // Bare array — defensive (Composio sometimes returns list tool results directly)
  assert.equal(isGithubRepositoryToolSuccess([]), true)
  // Back-compat with proxy shape (status-based) when `successful` is absent
  assert.equal(isGithubRepositoryToolSuccess({ status: 200, data: [] }), true)
  assert.equal(isGithubRepositoryToolSuccess({ status: 403 }), false)
  // Non-objects
  assert.equal(isGithubRepositoryToolSuccess(null), false)
  assert.equal(isGithubRepositoryToolSuccess('boom'), false)
})

test('extractGithubRepositoryArray recognizes Composio tool-execute .details shape', async () => {
  const { extractGithubRepositoryArray } = await import(
    new URL('./github-repositories.ts', import.meta.url).href,
  )

  // Top-level .details (some Composio list tools wrap the result this way)
  assert.deepEqual(
    extractGithubRepositoryArray({ details: [{ full_name: 'acme/web' }] }),
    [{ full_name: 'acme/web' }],
  )
  // Nested data.details
  assert.deepEqual(
    extractGithubRepositoryArray({ data: { details: [{ full_name: 'acme/api' }] } }),
    [{ full_name: 'acme/api' }],
  )
})
