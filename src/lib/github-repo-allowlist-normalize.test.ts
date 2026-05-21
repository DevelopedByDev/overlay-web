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

// PATCH /api/app/projects contract: when the route forwards
// githubRepoAllowlist through this normalizer, a rejection must
// surface the offending raw input verbatim so the client can show
// the user exactly which entry was bad in an HTTP 400 response.
test('PATCH route contract: rejection error message contains the offending entry verbatim', async () => {
  const { normalizeGithubRepoAllowlist } = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const offender = 'BAD ENTRY/with spaces'
  assert.throws(
    () => normalizeGithubRepoAllowlist([offender]),
    (err: unknown) => (err as Error).message.includes(offender),
  )
})

// Consistency invariant: the regex in convex/lib (used by the normalizer + the
// PATCH route's defense-in-depth check) MUST match the duplicate in
// packages/overlay-app-core/src/projects.ts (used by the picker UI's
// manual-entry validator). The two cannot share a module because of the
// package-boundary tsconfig include glob — this test prevents silent drift.
//
// We compare via file-text inspection rather than dynamic import because
// app-core's projects.ts transitively imports sibling .ts modules without
// extensions, which node:test's experimental-strip-types resolver rejects.
// File-text inspection is bundler-agnostic and asserts the same invariant.
test('GITHUB_REPO_ALLOWLIST_REGEX is byte-identical in convex/lib and app-core', async () => {
  const { readFile } = await import('node:fs/promises')
  const normalizerModule = await import(
    new URL('../../convex/lib/github-repo-allowlist-normalize.ts', import.meta.url).href,
  )
  const convexRegex = normalizerModule.GITHUB_REPO_ALLOWLIST_REGEX as RegExp

  // Read app-core's projects.ts as text and extract its regex literal.
  const appCorePath = new URL('../../packages/overlay-app-core/src/projects.ts', import.meta.url)
  const appCoreSource = await readFile(appCorePath, 'utf8')
  // Capture the entire regex literal up to end-of-line (the literal contains
  // an escaped slash `\/` so a greedy "up to next `/`" extraction would stop early).
  const match = appCoreSource.match(/GITHUB_REPO_ALLOWLIST_REGEX_DISPLAY\s*=\s*(\/.+\/[gimsuy]*)\s*$/m)
  assert.ok(match, 'app-core/projects.ts must declare GITHUB_REPO_ALLOWLIST_REGEX_DISPLAY')
  const appCoreLiteral = match[1] // e.g. "/^[a-z0-9][a-z0-9-]*\/[a-z0-9._-]+$/"

  // The convex regex's source + flags must produce the same literal.
  const convexLiteral = `/${convexRegex.source}/${convexRegex.flags}`
  assert.equal(
    appCoreLiteral,
    convexLiteral,
    `Regex drift between convex/lib (${convexLiteral}) and app-core (${appCoreLiteral}). Keep them in sync.`,
  )
})

// MED 10 regression: ensure URL-encoded slashes do not slip through the
// extractor's "repository" field rule (Rule 5 in extractRepoFromComposioGithubArgs).
// The extractor splits on the literal '/' character; an encoded slash like
// 'acme%2Fweb' contains no literal '/' and must be rejected (return null,
// which the wrap treats as "no repo found — allow as non-repo-scoped").
// We assert directly against the extractor here to lock the behavior.
test('extractRepoFromComposioGithubArgs: percent-encoded slashes do not match owner/name', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./tools/github-repo-allowlist.ts', import.meta.url).href,
  )
  // Encoded slash in `repository` — no literal '/' present.
  assert.equal(
    extractRepoFromComposioGithubArgs('GITHUB_GET_REPOSITORY', { repository: 'acme%2Fweb' }),
    null,
  )
  // Encoded slash inside the second segment — splits to ['acme', 'web%2Fother']
  // which the regex rejects (% is not in the repo charset).
  assert.equal(
    extractRepoFromComposioGithubArgs('GITHUB_GET_REPOSITORY', { repository: 'acme/web%2Fother' }),
    null,
  )
})
