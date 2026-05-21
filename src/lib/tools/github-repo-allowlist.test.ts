import test from 'node:test'
import assert from 'node:assert/strict'

test('extractRepoFromComposioGithubArgs extracts repo from full_name format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs('GITHUB_GET_REPO', {
    full_name: 'octocat/Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs extracts repo from owner+repo format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs('GITHUB_GET_REPO', {
    owner: 'octocat',
    repo: 'Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs extracts repo from owner+name format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs('GITHUB_LIST_BRANCHES', {
    owner: 'octocat',
    name: 'Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs returns null when no repo argument present', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs('GITHUB_LIST_USER_ORGANIZATIONS', {
    username: 'octocat',
  })
  assert.equal(result, null)
})

test('isGithubComposioTool returns true for GITHUB_* tools', async () => {
  const { isGithubComposioTool } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = isGithubComposioTool('GITHUB_GET_REPO')
  assert.equal(result, true)
})

test('isGithubComposioTool returns false for non-GITHUB tools', async () => {
  const { isGithubComposioTool } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = isGithubComposioTool('NOTION_CREATE_PAGE')
  assert.equal(result, false)
})

test('isGithubComposioTool returns false for empty string', async () => {
  const { isGithubComposioTool } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = isGithubComposioTool('')
  assert.equal(result, false)
})
