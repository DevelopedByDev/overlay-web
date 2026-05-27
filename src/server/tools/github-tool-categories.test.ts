import test from 'node:test'
import assert from 'node:assert/strict'

const MODULE_URL = new URL('./github-tool-categories.ts', import.meta.url).href

// All 9 current DEFAULT slugs (mirrors CHAT_GITHUB_READONLY_TOOL_SLUGS in
// src/server/tools/composio-tools.ts at the time T1 was authored).
// Each maps to a category derived by applying the heuristic in order.
const DEFAULT_SLUG_CATEGORIES: ReadonlyArray<[string, string]> = [
  ['GITHUB_GET_A_REPOSITORY', 'Repositories'],
  // _CONTENT (step 8) comes before _REPOSITORY (step 10)
  ['GITHUB_GET_REPOSITORY_CONTENT', 'Content & Search'],
  // _README (step 8) comes before _REPOSITORY (step 10)
  ['GITHUB_GET_A_REPOSITORY_README', 'Content & Search'],
  // _COMMIT (step 4) — matches COMMITS too via substring
  ['GITHUB_LIST_COMMITS', 'Commits & Refs'],
  ['GITHUB_GET_A_COMMIT', 'Commits & Refs'],
  // _ISSUES (step 3)
  ['GITHUB_LIST_REPOSITORY_ISSUES', 'Issues'],
  ['GITHUB_GET_AN_ISSUE', 'Issues'],
  // _PULL_REQUEST (step 2)
  ['GITHUB_LIST_PULL_REQUESTS', 'Pull Requests'],
  ['GITHUB_GET_A_PULL_REQUEST', 'Pull Requests'],
]

for (const [slug, expected] of DEFAULT_SLUG_CATEGORIES) {
  test(`categorizeGithubToolSlug: ${slug} → ${expected}`, async () => {
    const { categorizeGithubToolSlug } = await import(MODULE_URL)
    assert.equal(categorizeGithubToolSlug(slug), expected)
  })
}

// Step 1's "ends with _COMMENT" wins over step 3's _ISSUE.
test('categorizeGithubToolSlug: GITHUB_CREATE_AN_ISSUE_COMMENT → Comments (not Issues)', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(categorizeGithubToolSlug('GITHUB_CREATE_AN_ISSUE_COMMENT'), 'Comments')
})

// Most-specific-noun rule: PR review comment is a comment, not a PR.
test('categorizeGithubToolSlug: GITHUB_GET_A_PULL_REQUEST_REVIEW_COMMENT → Comments', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(
    categorizeGithubToolSlug('GITHUB_GET_A_PULL_REQUEST_REVIEW_COMMENT'),
    'Comments',
  )
})

// Step 2 _REVIEW maps to Pull Requests.
test('categorizeGithubToolSlug: GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST → Pull Requests', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(
    categorizeGithubToolSlug('GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST'),
    'Pull Requests',
  )
})

// Step 5 _WORKFLOW.
test('categorizeGithubToolSlug: GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY → Workflows & Actions', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(
    categorizeGithubToolSlug('GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY'),
    'Workflows & Actions',
  )
})

// _DEPLOYMENT is intentionally not mapped — falls through to Other.
test('categorizeGithubToolSlug: GITHUB_CREATE_A_DEPLOYMENT → Other', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(categorizeGithubToolSlug('GITHUB_CREATE_A_DEPLOYMENT'), 'Other')
})

test('categorizeGithubToolSlug: unknown slug GITHUB_ZZZ_UNKNOWN_THING → Other', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  assert.equal(categorizeGithubToolSlug('GITHUB_ZZZ_UNKNOWN_THING'), 'Other')
})

// Step 4's "_TAG but not _RELEASE_TAG" exception — release tag is a release op.
test('categorizeGithubToolSlug: _RELEASE_TAG falls through step 4 to step 6 → Releases', async () => {
  const { categorizeGithubToolSlug } = await import(MODULE_URL)
  // A hypothetical slug containing _RELEASE_TAG that should land in Releases.
  assert.equal(
    categorizeGithubToolSlug('GITHUB_GET_A_RELEASE_TAG'),
    'Releases',
  )
})
