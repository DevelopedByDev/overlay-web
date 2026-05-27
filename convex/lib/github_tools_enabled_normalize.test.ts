import test from 'node:test'
import assert from 'node:assert/strict'

const MODULE_URL = new URL('./github_tools_enabled_normalize.ts', import.meta.url).href

test('normalizeGithubToolsEnabled: empty array → empty array', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(normalizeGithubToolsEnabled([]), [])
})

test('normalizeGithubToolsEnabled: valid slug passes through', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(
    normalizeGithubToolsEnabled(['GITHUB_GET_A_REPOSITORY']),
    ['GITHUB_GET_A_REPOSITORY'],
  )
})

test('normalizeGithubToolsEnabled: drops malformed entry "not-a-slug"', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(normalizeGithubToolsEnabled(['not-a-slug']), [])
})

test('normalizeGithubToolsEnabled: drops lowercase entry "GITHUB_lowercase"', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(normalizeGithubToolsEnabled(['GITHUB_lowercase']), [])
})

test('normalizeGithubToolsEnabled: drops empty string', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(normalizeGithubToolsEnabled(['']), [])
})

test('normalizeGithubToolsEnabled: drops whitespace-only entry', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(normalizeGithubToolsEnabled(['   ']), [])
})

test('normalizeGithubToolsEnabled: drops hard-denied slug GITHUB_DELETE_A_REPOSITORY', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(
    normalizeGithubToolsEnabled([
      'GITHUB_DELETE_A_REPOSITORY',
      'GITHUB_GET_A_REPOSITORY',
    ]),
    ['GITHUB_GET_A_REPOSITORY'],
  )
})

test('normalizeGithubToolsEnabled: trims whitespace', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(
    normalizeGithubToolsEnabled(['  GITHUB_GET_A_REPOSITORY  ']),
    ['GITHUB_GET_A_REPOSITORY'],
  )
})

test('normalizeGithubToolsEnabled: dedupes', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(
    normalizeGithubToolsEnabled([
      'GITHUB_GET_A_REPOSITORY',
      'GITHUB_GET_A_REPOSITORY',
      'GITHUB_LIST_COMMITS',
    ]),
    ['GITHUB_GET_A_REPOSITORY', 'GITHUB_LIST_COMMITS'],
  )
})

test('normalizeGithubToolsEnabled: sorts alphabetically', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  assert.deepEqual(
    normalizeGithubToolsEnabled([
      'GITHUB_LIST_COMMITS',
      'GITHUB_GET_A_REPOSITORY',
      'GITHUB_GET_AN_ISSUE',
    ]),
    ['GITHUB_GET_AN_ISSUE', 'GITHUB_GET_A_REPOSITORY', 'GITHUB_LIST_COMMITS'],
  )
})

test('normalizeGithubToolsEnabled: caps at 500 entries', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  // Generate 600 distinct valid slugs.
  const input = Array.from({ length: 600 }, (_, i) => {
    // Pad index so they sort predictably; use only uppercase letters/digits/underscores.
    const idx = String(i).padStart(4, '0')
    return `GITHUB_TEST_TOOL_${idx}`
  })
  const result = normalizeGithubToolsEnabled(input)
  assert.equal(result.length, 500)
})

test('normalizeGithubToolsEnabled: skips non-string entries (null, number, object)', async () => {
  const { normalizeGithubToolsEnabled } = await import(MODULE_URL)
  // Cast to satisfy the readonly string[] signature — runtime defensive check
  // is what we're verifying.
  const input = [
    null,
    42,
    {},
    'GITHUB_GET_A_REPOSITORY',
  ] as unknown as readonly string[]
  assert.deepEqual(normalizeGithubToolsEnabled(input), ['GITHUB_GET_A_REPOSITORY'])
})
