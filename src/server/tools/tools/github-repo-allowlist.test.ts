import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

test('extractRepoFromComposioGithubArgs extracts repo from full_name format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs({
    full_name: 'octocat/Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs extracts repo from owner+repo format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs({
    owner: 'octocat',
    repo: 'Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs extracts repo from owner+name format', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs({
    owner: 'octocat',
    name: 'Hello',
  })
  assert.deepEqual(result, { owner: 'octocat', name: 'hello' })
})

test('extractRepoFromComposioGithubArgs returns null when no repo argument present', async () => {
  const { extractRepoFromComposioGithubArgs } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const result = extractRepoFromComposioGithubArgs({
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

test('empty project repo list blocks repo-targeted GitHub tools', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy([])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_GET_REPO: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = await wrapped.GITHUB_GET_REPO.execute({ full_name: 'acme/web' }, {})
  assert.equal(policy.enabled, true)
  assert.equal(executeStub.mock.callCount(), 0)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'repo_not_in_allowlist')
  assert.deepEqual(result.allowedRepos, [])
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
  // Params declared so the mock's Parameters tuple types as [unknown, unknown];
  // the assertion below indexes arguments[0]. eslint-disable-next-line —
  // unused-vars doesn't recognize node:test mock signatures.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const executeStub = mock.fn(async (_input: unknown, _ctx: unknown) => ({ ok: true, data: 'real-result' }))
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

// Regression: a fork call WITHOUT explicit target fields would, on the GitHub
// API, fork to the caller's default account — outside the allowlist. The
// wrap must block fork tools when no explicit, allowed target is supplied.
test('GITHUB_FORK_REPOSITORY blocks when target fields are missing (default-deny)', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_FORK_REPOSITORY: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = await wrapped.GITHUB_FORK_REPOSITORY.execute(
    { owner: 'acme', repo: 'web' },
    {},
  ) as { ok: boolean; error?: string }
  assert.equal(executeStub.mock.callCount(), 0)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'repo_not_in_allowlist')
})

// ── Fix 3: default-deny on null extractor result for repo-scoped tools ──────
//
// When the extractor returns null we used to delegate to the original execute
// as "non-repo-scoped op (e.g. LIST_USER_ORGANIZATIONS) — allow". After the
// curated list was tightened, every remaining GITHUB_* tool is repo-scoped,
// so null means "we couldn't find the repo coords" — not "no repo coords
// exist". Treat null as deny for repo-required tools.
//
// Concretely: a percent-encoded slash in `repository` returns null from the
// extractor (Rule 5 splits on literal '/'), and Composio's HTTP layer would
// URL-decode the path param downstream and reach `evil/corp`. Default-deny.
test('GITHUB_GET_A_REPOSITORY blocks when repo arg is percent-encoded (extractor null path)', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )
  const policy = buildGithubRepoPolicy(['acme/web'])
  const executeStub = mock.fn(async () => ({ ok: true }))
  const toolSet = { GITHUB_GET_A_REPOSITORY: { execute: executeStub } }
  const wrapped = applyGithubRepoAllowlistToTools(toolSet, policy)
  const result = (await wrapped.GITHUB_GET_A_REPOSITORY.execute(
    { repository: 'evil%2Fcorp' },
    {},
  )) as { ok: boolean; error?: string }
  // Repo-required tool with no parseable coord must be denied — not delegated.
  assert.equal(executeStub.mock.callCount(), 0)
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /repo_not_in_allowlist|repo_arg_required/)
})

// ── Task 1: green baseline for the post-swap GITHUB_* ToolSet shape ──────────
//
// After Task 3 swaps `composio.create()` + `session.tools()` for the static
// `composio.tools.get(entityId, { tools: [...] })`, individual GITHUB_* tools
// land in the chat's ToolSet as `{ description, execute }` objects. This test
// pins the wrap's behavior against that realistic post-swap shape so any later
// regression points to the connection layer, not the wrap itself.
//
// Contract adaptation note: the briefing's literal policy
// `{ enabled: true, allowedRepos: ['acme/web'] }` does not match the real
// `GithubRepoPolicy` (which requires `list` and an `allows()` method — see
// github-repo-allowlist.ts:140-151). The test below uses the documented
// constructor `buildGithubRepoPolicy(['acme/web'])`, which is the same
// convention every other wrap test in this file uses. The intent — verify
// allowed-passes-through + disallowed-blocks against a realistic toolset
// shape that includes `description` alongside `execute` — is preserved.
test('applyGithubRepoAllowlistToTools wraps GITHUB_* tools with execute callables (post-swap shape)', async () => {
  const { applyGithubRepoAllowlistToTools, buildGithubRepoPolicy } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )

  let composioCalled = false
  const fakeToolSet = {
    GITHUB_GET_REPO: {
      description: 'Get a github repo',
      execute: async (input: { owner: string; repo: string }) => {
        composioCalled = true
        return { ok: true, name: input.repo }
      },
    },
  }

  const policy = buildGithubRepoPolicy(['acme/web'])
  const wrapped = applyGithubRepoAllowlistToTools(fakeToolSet, policy)

  composioCalled = false
  const allowed = await wrapped.GITHUB_GET_REPO.execute(
    { owner: 'acme', repo: 'web' },
    {},
  )
  assert.equal(composioCalled, true, 'composio should be called for allowed repo')
  assert.equal((allowed as { ok: boolean }).ok, true)

  composioCalled = false
  const blocked = await wrapped.GITHUB_GET_REPO.execute(
    { owner: 'evil', repo: 'corp' },
    {},
  )
  assert.equal(composioCalled, false, 'composio must NOT be called for disallowed repo')
  assert.equal((blocked as { ok: boolean }).ok, false)
  assert.match(
    (blocked as { error: string }).error,
    /repo_not_in_allowlist|not.*allowed/i,
  )
})
