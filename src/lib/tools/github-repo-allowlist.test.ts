import test, { mock } from 'node:test'
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

// ── wrap + policy tests (Task 7) ──────────────────────────────────────────────

test('applyGithubRepoAllowlistToTools is identity when policy is disabled', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(undefined)
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  assert.equal(wrapped.GITHUB_GET_REPO, toolSet.GITHUB_GET_REPO)
})

test('applyGithubRepoAllowlistToTools does not wrap non-GITHUB_ tools', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { NOTION_CREATE_PAGE: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  assert.equal(wrapped.NOTION_CREATE_PAGE, toolSet.NOTION_CREATE_PAGE)
})

test('applyGithubRepoAllowlistToTools passes allowed repo through unchanged', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(
    async (_input: unknown, _ctx: unknown) => ({ ok: true, data: 'real-result' }),
  )
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = await wrapped.GITHUB_GET_REPO.execute({ full_name: 'acme/web' }, {})
  assert.equal(executeStub.mock.callCount(), 1)
  assert.deepEqual(executeStub.mock.calls[0].arguments[0], { full_name: 'acme/web' })
  assert.deepEqual(result, { ok: true, data: 'real-result' })
})

test('zero invocation of originalExecute when a non-allowed repo is targeted', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  await wrapped.GITHUB_GET_REPO.execute({ full_name: 'octocat/hello' }, {})
  assert.equal(executeStub.mock.callCount(), 0)
})

test('applyGithubRepoAllowlistToTools returns structured refusal payload when blocked', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn()
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = await wrapped.GITHUB_GET_REPO.execute({ full_name: 'octocat/hello' }, {})
  assert.equal(result.ok, false)
  assert.equal(result.error, 'repo_not_in_allowlist')
  assert.equal(result.blockedRepo, 'octocat/hello')
  assert.deepEqual(result.allowedRepos, ['acme/web'])
  assert.ok(typeof result.message === 'string' && result.message.length > 0)
})

test('applyGithubRepoAllowlistToTools matches case-insensitively', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  await wrapped.GITHUB_GET_REPO.execute({ owner: 'ACME', repo: 'Web' }, {})
  assert.equal(executeStub.mock.callCount(), 1)
})

test('GITHUB_FORK_REPOSITORY requires both source and target repos on allowlist — blocks when only source is listed', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_FORK_REPOSITORY: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = await wrapped.GITHUB_FORK_REPOSITORY.execute(
    { owner: 'acme', repo: 'web', target_owner: 'octocat', target_repo: 'hello' },
    {},
  )
  assert.equal(executeStub.mock.callCount(), 0)
  assert.equal(result.ok, false)
})

test('GITHUB_FORK_REPOSITORY requires both source and target repos on allowlist — allows when both are listed', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web', 'acme/fork-target'])
  const executeStub2 = mock.fn(async () => ({ ok: true }))
  const toolSet2 = { GITHUB_FORK_REPOSITORY: { execute: executeStub2 } }
  const wrapped2 = applyGithubRepoAllowlistToTools(toolSet2, policy)
  await wrapped2.GITHUB_FORK_REPOSITORY.execute(
    { owner: 'acme', repo: 'web', target_owner: 'acme', target_repo: 'fork-target' },
    {},
  )
  assert.equal(executeStub2.mock.callCount(), 1)
})
