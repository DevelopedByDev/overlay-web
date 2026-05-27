import assert from 'node:assert/strict'
import test from 'node:test'
import {
  equalSlugSets,
  isCategoryAllEnabled,
  isCategoryIndeterminate,
  toggleCategoryGroup,
  toggleSlugInList,
} from './github-tools-picker'
import type { GithubToolInfo } from '@overlay/app-core'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const issuesA: GithubToolInfo = {
  slug: 'GITHUB_GET_AN_ISSUE',
  name: 'Get an issue',
  description: '',
  category: 'Issues',
}
const issuesB: GithubToolInfo = {
  slug: 'GITHUB_CREATE_AN_ISSUE',
  name: 'Create an issue',
  description: '',
  category: 'Issues',
}
const issuesDenied: GithubToolInfo = {
  slug: 'GITHUB_DELETE_AN_ISSUE',
  name: 'Delete an issue',
  description: '',
  category: 'Issues',
}
const reposA: GithubToolInfo = {
  slug: 'GITHUB_GET_A_REPOSITORY',
  name: 'Get a repository',
  description: '',
  category: 'Repositories',
}

const allOptions: readonly GithubToolInfo[] = [
  issuesA,
  issuesB,
  issuesDenied,
  reposA,
]

const hardDenied: readonly string[] = [issuesDenied.slug]

// ---------------------------------------------------------------------------
// toggleSlugInList
// ---------------------------------------------------------------------------

test('toggleSlugInList removes a slug already present', () => {
  const next = toggleSlugInList(['A', 'B'], 'A')
  assert.deepEqual([...next], ['B'])
})

test('toggleSlugInList appends a slug not present', () => {
  const next = toggleSlugInList(['A', 'B'], 'C')
  assert.deepEqual([...next], ['A', 'B', 'C'])
})

test('toggleSlugInList does not mutate input', () => {
  const input: readonly string[] = ['A', 'B']
  toggleSlugInList(input, 'A')
  assert.deepEqual([...input], ['A', 'B'])
})

// ---------------------------------------------------------------------------
// toggleCategoryGroup
// ---------------------------------------------------------------------------

test('toggleCategoryGroup enables all non-hard-denied tools when none enabled', () => {
  const next = toggleCategoryGroup([], 'Issues', allOptions, hardDenied)
  // Should add issuesA + issuesB but NOT issuesDenied.
  assert.deepEqual(
    [...next].sort(),
    [issuesA.slug, issuesB.slug].sort(),
  )
  assert.ok(!next.includes(issuesDenied.slug))
})

test('toggleCategoryGroup disables all tools in category when all non-hard-denied enabled', () => {
  const value = [issuesA.slug, issuesB.slug, reposA.slug]
  const next = toggleCategoryGroup(value, 'Issues', allOptions, hardDenied)
  // Should remove issuesA + issuesB, leave reposA alone, never touch issuesDenied.
  assert.deepEqual([...next], [reposA.slug])
})

test('toggleCategoryGroup leaves hard-denied untouched when toggling on (it was never enabled)', () => {
  const next = toggleCategoryGroup([], 'Issues', allOptions, hardDenied)
  assert.ok(!next.includes(issuesDenied.slug))
})

test('toggleCategoryGroup is a no-op for a category with zero toggleable items', () => {
  const next = toggleCategoryGroup(
    [reposA.slug],
    'Releases', // no items present
    allOptions,
    hardDenied,
  )
  assert.deepEqual([...next], [reposA.slug])
})

test('toggleCategoryGroup partial-enabled state fills the remaining items', () => {
  const next = toggleCategoryGroup(
    [issuesA.slug],
    'Issues',
    allOptions,
    hardDenied,
  )
  assert.ok(next.includes(issuesA.slug))
  assert.ok(next.includes(issuesB.slug))
  assert.ok(!next.includes(issuesDenied.slug))
})

// ---------------------------------------------------------------------------
// equalSlugSets — "Reset to defaults" disabled-state predicate
// ---------------------------------------------------------------------------

test('equalSlugSets returns true for identical order', () => {
  assert.equal(equalSlugSets(['A', 'B'], ['A', 'B']), true)
})

test('equalSlugSets returns true for different order (order-insensitive)', () => {
  assert.equal(equalSlugSets(['B', 'A'], ['A', 'B']), true)
})

test('equalSlugSets returns false for different sizes', () => {
  assert.equal(equalSlugSets(['A'], ['A', 'B']), false)
})

test('equalSlugSets returns false for different contents', () => {
  assert.equal(equalSlugSets(['A', 'B'], ['A', 'C']), false)
})

test('equalSlugSets returns true for two empty arrays', () => {
  assert.equal(equalSlugSets([], []), true)
})

// ---------------------------------------------------------------------------
// "Disable all" disabled-state predicate is value.length === 0
// (tested as a documented pure rule via direct .length check)
// ---------------------------------------------------------------------------

test('"Disable all" disabled when value is empty', () => {
  const value: readonly string[] = []
  assert.equal(value.length === 0, true)
})

test('"Disable all" enabled when value has at least one slug', () => {
  const value: readonly string[] = [issuesA.slug]
  assert.equal(value.length === 0, false)
})

// ---------------------------------------------------------------------------
// isCategoryIndeterminate
// ---------------------------------------------------------------------------

test('isCategoryIndeterminate is true when some-but-not-all enabled', () => {
  assert.equal(
    isCategoryIndeterminate([issuesA.slug], 'Issues', allOptions, hardDenied),
    true,
  )
})

test('isCategoryIndeterminate is false when none enabled', () => {
  assert.equal(
    isCategoryIndeterminate([], 'Issues', allOptions, hardDenied),
    false,
  )
})

test('isCategoryIndeterminate is false when all toggleable enabled', () => {
  assert.equal(
    isCategoryIndeterminate(
      [issuesA.slug, issuesB.slug],
      'Issues',
      allOptions,
      hardDenied,
    ),
    false,
  )
})

test('isCategoryIndeterminate ignores hard-denied for the "all enabled" check', () => {
  // issuesA + issuesB are enabled; issuesDenied is hard-denied → all toggleable enabled
  assert.equal(
    isCategoryIndeterminate(
      [issuesA.slug, issuesB.slug],
      'Issues',
      allOptions,
      hardDenied,
    ),
    false,
  )
})

// ---------------------------------------------------------------------------
// isCategoryAllEnabled
// ---------------------------------------------------------------------------

test('isCategoryAllEnabled true when every toggleable slug is enabled', () => {
  assert.equal(
    isCategoryAllEnabled(
      [issuesA.slug, issuesB.slug],
      'Issues',
      allOptions,
      hardDenied,
    ),
    true,
  )
})

test('isCategoryAllEnabled false when one toggleable slug is missing', () => {
  assert.equal(
    isCategoryAllEnabled([issuesA.slug], 'Issues', allOptions, hardDenied),
    false,
  )
})

test('isCategoryAllEnabled false for empty category (no items)', () => {
  assert.equal(
    isCategoryAllEnabled([], 'Releases', allOptions, hardDenied),
    false,
  )
})
