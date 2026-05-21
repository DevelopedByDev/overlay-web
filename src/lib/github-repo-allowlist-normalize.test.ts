import test from 'node:test'
import assert from 'node:assert/strict'

test('normalizeGithubRepoAllowlist: trim + lowercase + dedupe + sort happy path', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const input = [' Acme/Web ', 'acme/web', 'b/a', 'a/b']
  const result = normalizeGithubRepoAllowlist(input)
  assert.deepEqual(result, ['a/b', 'acme/web', 'b/a'])
})

test('normalizeGithubRepoAllowlist: rejects owner/ (missing repo name)', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  assert.throws(
    () => normalizeGithubRepoAllowlist(['owner/']),
    (err: unknown) => {
      const error = err as Error
      return (
        error.message.includes('owner/') &&
        error.message.toLowerCase().includes('malformed')
      )
    },
  )
})

test('normalizeGithubRepoAllowlist: rejects /name (missing owner)', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  assert.throws(
    () => normalizeGithubRepoAllowlist(['/name']),
    (err: unknown) => {
      const error = err as Error
      return (
        error.message.includes('/name') &&
        error.message.toLowerCase().includes('malformed')
      )
    },
  )
})

test('normalizeGithubRepoAllowlist: rejects has space/repo (contains space)', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  assert.throws(
    () => normalizeGithubRepoAllowlist(['has space/repo']),
    (err: unknown) => {
      const error = err as Error
      return (
        error.message.includes('has space/repo') &&
        error.message.toLowerCase().includes('malformed')
      )
    },
  )
})

test('normalizeGithubRepoAllowlist: rejects empty string', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  assert.throws(
    () => normalizeGithubRepoAllowlist(['']),
    (err: unknown) => {
      const error = err as Error
      return error.message.toLowerCase().includes('malformed')
    },
  )
})

test('normalizeGithubRepoAllowlist: truncates at MAX entries (100)', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const input = Array.from({ length: 150 }, (_, i) => `owner${i}/repo${i}`)
  const result = normalizeGithubRepoAllowlist(input)
  assert.equal(result.length, 100)
})

test('normalizeGithubRepoAllowlist: empty input yields empty array', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const result = normalizeGithubRepoAllowlist([])
  assert.deepEqual(result, [])
})

test('normalizeGithubRepoAllowlist: canonical valid forms accepted', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const input = ['acme/web', 'me-co/awesome.tool_v2', 'a/b']
  const result = normalizeGithubRepoAllowlist(input)
  assert.deepEqual(result, ['a/b', 'acme/web', 'me-co/awesome.tool_v2'])
})
