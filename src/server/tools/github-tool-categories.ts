/**
 * Maps Composio GitHub tool slugs to human-readable categories for UI grouping.
 *
 * Pure substring heuristic — applied in order, first match wins. The ordering
 * is meaningful because some slugs touch multiple nouns (e.g. an "issue comment"
 * is fundamentally a Comment, not an Issue).
 *
 * No I/O, no imports — safe to use in any runtime (browser, Convex, Node).
 */

export type GithubToolCategory =
  | 'Repositories'
  | 'Issues'
  | 'Pull Requests'
  | 'Comments'
  | 'Commits & Refs'
  | 'Workflows & Actions'
  | 'Releases'
  | 'Collaboration'
  | 'Content & Search'
  | 'User & Org'
  | 'Other'

/**
 * Returns the category for a Composio GitHub tool slug. Unknown or
 * unrecognized shapes return 'Other'.
 *
 * Heuristic (first match wins):
 *  1. Ends with _COMMENT, or contains _COMMENTS/_COMMENT_ → Comments
 *     (acting on a comment object takes precedence over the parent issue/PR)
 *  2. _PULL_REQUEST, _REVIEW, or _MERGE → Pull Requests
 *  3. _ISSUE, _ISSUES, _LABEL, _MILESTONE → Issues
 *  4. _COMMIT, _REFERENCE, _BRANCH, _TAG (but NOT _RELEASE_TAG) → Commits & Refs
 *  5. _WORKFLOW, _ACTION_, _JOB_, _RUN_ → Workflows & Actions
 *  6. _RELEASE → Releases
 *  7. _COLLABORATOR, _TEAM, _INVITATION, _MEMBER → Collaboration
 *  8. _CONTENT, _README, _SEARCH_, _BLOB, _TREE → Content & Search
 *  9. _USER, _ORGANIZATION, _PROFILE → User & Org
 * 10. _REPOSITORY, _REPO_ → Repositories
 * 11. else → Other
 */
export function categorizeGithubToolSlug(slug: string): GithubToolCategory {
  // Step 1: Comments — ends with _COMMENT, or contains _COMMENTS / _COMMENT_
  if (
    slug.endsWith('_COMMENT') ||
    slug.includes('_COMMENTS') ||
    slug.includes('_COMMENT_')
  ) {
    return 'Comments'
  }

  // Step 2: Pull Requests — _PULL_REQUEST / _REVIEW / _MERGE
  if (
    slug.includes('_PULL_REQUEST') ||
    slug.includes('_REVIEW') ||
    slug.includes('_MERGE')
  ) {
    return 'Pull Requests'
  }

  // Step 3: Issues — _ISSUE / _ISSUES / _LABEL / _MILESTONE
  if (
    slug.includes('_ISSUE') ||
    slug.includes('_LABEL') ||
    slug.includes('_MILESTONE')
  ) {
    return 'Issues'
  }

  // Step 4: Commits & Refs — _COMMIT / _REFERENCE / _BRANCH / _TAG (but not _RELEASE_TAG)
  if (
    slug.includes('_COMMIT') ||
    slug.includes('_REFERENCE') ||
    slug.includes('_BRANCH') ||
    (slug.includes('_TAG') && !slug.includes('_RELEASE_TAG'))
  ) {
    return 'Commits & Refs'
  }

  // Step 5: Workflows & Actions — _WORKFLOW / _ACTION_ / _JOB_ / _RUN_
  if (
    slug.includes('_WORKFLOW') ||
    slug.includes('_ACTION_') ||
    slug.includes('_JOB_') ||
    slug.includes('_RUN_')
  ) {
    return 'Workflows & Actions'
  }

  // Step 6: Releases — _RELEASE
  if (slug.includes('_RELEASE')) {
    return 'Releases'
  }

  // Step 7: Collaboration — _COLLABORATOR / _TEAM / _INVITATION / _MEMBER
  if (
    slug.includes('_COLLABORATOR') ||
    slug.includes('_TEAM') ||
    slug.includes('_INVITATION') ||
    slug.includes('_MEMBER')
  ) {
    return 'Collaboration'
  }

  // Step 8: Content & Search — _CONTENT / _README / _SEARCH_ / _BLOB / _TREE
  if (
    slug.includes('_CONTENT') ||
    slug.includes('_README') ||
    slug.includes('_SEARCH_') ||
    slug.includes('_BLOB') ||
    slug.includes('_TREE')
  ) {
    return 'Content & Search'
  }

  // Step 9: User & Org — _USER / _ORGANIZATION / _PROFILE
  if (
    slug.includes('_USER') ||
    slug.includes('_ORGANIZATION') ||
    slug.includes('_PROFILE')
  ) {
    return 'User & Org'
  }

  // Step 10: Repositories — _REPOSITORY / _REPO_
  if (slug.includes('_REPOSITORY') || slug.includes('_REPO_')) {
    return 'Repositories'
  }

  // Step 11: Other
  return 'Other'
}
