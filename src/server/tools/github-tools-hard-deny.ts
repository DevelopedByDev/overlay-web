/**
 * Hard-deny list for Composio GitHub tool slugs.
 *
 * Slugs in this module are NEVER eligible for the chat AI, regardless of any
 * per-project tools-enabled toggle. The list covers:
 *   - destructive repo-level ops (delete repo, transfer repo, delete branch/ref)
 *   - access-control surface changes (add/remove collaborator, delete environment)
 *   - secret/token/key manipulation (action-verb-gated, see below)
 *
 * Read-only inspection is fine and should NOT appear here. For example,
 * `GITHUB_SECRET_SCANNING_GET_AN_ALERT` is a security feature that lists
 * detected secrets in a repo — it does not manipulate secret values, so it
 * is intentionally NOT denied.
 *
 * No imports — this module is the leaf of the deny graph. Module 3 (the
 * Convex normalizer) imports it; nothing imports back.
 */

export const HARD_DENIED_GITHUB_TOOL_SLUGS: readonly string[] = [
  'GITHUB_DELETE_A_REPOSITORY',
  'GITHUB_ADD_A_REPOSITORY_COLLABORATOR',
  'GITHUB_REMOVE_A_REPOSITORY_COLLABORATOR',
  'GITHUB_TRANSFER_A_REPOSITORY',
  'GITHUB_DELETE_A_REFERENCE',
  'GITHUB_DELETE_AN_ENVIRONMENT',
]

/**
 * Action-verb-gated patterns for secret/token/key manipulation.
 *
 * Decision: we gate on action verbs (CREATE/UPDATE/SET/DELETE/PUT/PATCH/REPLACE/ADD/REMOVE)
 * rather than using a broad `^GITHUB_.*_SECRET(_|$)` match. Rationale:
 * GitHub's "secret scanning" feature exposes read-only tools (e.g.
 * `GITHUB_SECRET_SCANNING_GET_AN_ALERT`, `GITHUB_LIST_SECRET_SCANNING_ALERTS`)
 * that surface detected-secret metadata — these are a legitimate read-only
 * security use case for the chat AI and must not be denied. The verb gate
 * keeps secret-write surfaces blocked while preserving these reads.
 */
export const HARD_DENIED_GITHUB_TOOL_PATTERNS: readonly RegExp[] = [
  /^GITHUB_(CREATE|UPDATE|SET|DELETE|PUT|PATCH|REPLACE|ADD|REMOVE)_.*_SECRET(_|$)/,
  /^GITHUB_(CREATE|UPDATE|SET|DELETE|PUT|PATCH|REPLACE|ADD|REMOVE)_.*_TOKEN(_|$)/,
  /^GITHUB_(CREATE|UPDATE|SET|DELETE|PUT|PATCH|REPLACE|ADD|REMOVE)_.*_KEY(_|$)/,
]

/**
 * Returns true if `slug` is hard-denied — either in the explicit list or
 * matching one of the action-verb-gated patterns. Case-sensitive (Composio
 * slugs are uppercase ASCII).
 */
export function isHardDeniedGithubTool(slug: string): boolean {
  if (HARD_DENIED_GITHUB_TOOL_SLUGS.includes(slug)) {
    return true
  }
  for (const pattern of HARD_DENIED_GITHUB_TOOL_PATTERNS) {
    if (pattern.test(slug)) {
      return true
    }
  }
  return false
}
