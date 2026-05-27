import test from 'node:test'
import assert from 'node:assert/strict'

const MODULE_URL = new URL('./github-tools-hard-deny.ts', import.meta.url).href

test('isHardDeniedGithubTool: explicit GITHUB_DELETE_A_REPOSITORY → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_DELETE_A_REPOSITORY'), true)
})

test('isHardDeniedGithubTool: explicit GITHUB_ADD_A_REPOSITORY_COLLABORATOR → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_ADD_A_REPOSITORY_COLLABORATOR'), true)
})

test('isHardDeniedGithubTool: explicit GITHUB_REMOVE_A_REPOSITORY_COLLABORATOR → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_REMOVE_A_REPOSITORY_COLLABORATOR'), true)
})

test('isHardDeniedGithubTool: explicit GITHUB_TRANSFER_A_REPOSITORY → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_TRANSFER_A_REPOSITORY'), true)
})

test('isHardDeniedGithubTool: explicit GITHUB_DELETE_A_REFERENCE → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_DELETE_A_REFERENCE'), true)
})

test('isHardDeniedGithubTool: explicit GITHUB_DELETE_AN_ENVIRONMENT → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_DELETE_AN_ENVIRONMENT'), true)
})

test('isHardDeniedGithubTool: sanity — GITHUB_GET_A_REPOSITORY → false', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_GET_A_REPOSITORY'), false)
})

test('isHardDeniedGithubTool: pattern — GITHUB_CREATE_REPOSITORY_DEPLOY_KEY → true (matches _KEY)', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_CREATE_REPOSITORY_DEPLOY_KEY'), true)
})

test('isHardDeniedGithubTool: pattern — GITHUB_CREATE_OR_UPDATE_ENVIRONMENT_SECRET → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_CREATE_OR_UPDATE_ENVIRONMENT_SECRET'), true)
})

// Action-verb-gated pattern decision: secret-scanning READS like
// GITHUB_SECRET_SCANNING_GET_AN_ALERT are a legitimate read-only feature
// (they list security alerts, they do not manipulate secret values).
// We gate the _SECRET pattern on action verbs (CREATE/UPDATE/SET/DELETE/PUT/PATCH)
// so a read-only inspection call is NOT denied.
test('isHardDeniedGithubTool: GITHUB_SECRET_SCANNING_GET_AN_ALERT → false (read-only security feature)', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_SECRET_SCANNING_GET_AN_ALERT'), false)
})

// Action-verb-gated pattern decision (continued): a UPDATE action against
// a secret IS denied — protects against secret manipulation.
test('isHardDeniedGithubTool: GITHUB_UPDATE_A_REPOSITORY_SECRET → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_UPDATE_A_REPOSITORY_SECRET'), true)
})

// Action-verb-gated pattern decision (token): a CREATE against a token
// (e.g. an installation token) IS denied.
test('isHardDeniedGithubTool: GITHUB_CREATE_AN_INSTALLATION_ACCESS_TOKEN → true', async () => {
  const { isHardDeniedGithubTool } = await import(MODULE_URL)
  assert.equal(isHardDeniedGithubTool('GITHUB_CREATE_AN_INSTALLATION_ACCESS_TOKEN'), true)
})

// HARD_DENIED_GITHUB_TOOL_SLUGS is the public constant — sanity-check shape.
test('HARD_DENIED_GITHUB_TOOL_SLUGS is a non-empty readonly string array', async () => {
  const { HARD_DENIED_GITHUB_TOOL_SLUGS } = await import(MODULE_URL)
  assert.ok(Array.isArray(HARD_DENIED_GITHUB_TOOL_SLUGS))
  assert.ok((HARD_DENIED_GITHUB_TOOL_SLUGS as readonly string[]).length > 0)
  for (const slug of HARD_DENIED_GITHUB_TOOL_SLUGS as readonly string[]) {
    assert.equal(typeof slug, 'string')
  }
})

// HARD_DENIED_GITHUB_TOOL_PATTERNS is the public constant — sanity-check shape.
test('HARD_DENIED_GITHUB_TOOL_PATTERNS is a non-empty readonly RegExp array', async () => {
  const { HARD_DENIED_GITHUB_TOOL_PATTERNS } = await import(MODULE_URL)
  assert.ok(Array.isArray(HARD_DENIED_GITHUB_TOOL_PATTERNS))
  assert.ok((HARD_DENIED_GITHUB_TOOL_PATTERNS as readonly RegExp[]).length > 0)
  for (const pattern of HARD_DENIED_GITHUB_TOOL_PATTERNS as readonly RegExp[]) {
    assert.ok(pattern instanceof RegExp)
  }
})
