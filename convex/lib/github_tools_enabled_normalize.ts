import { isHardDeniedGithubTool } from '../../src/server/tools/github-tools-hard-deny'

/**
 * Regex for a well-formed Composio GitHub tool slug.
 * Composio's slugs are uppercase ASCII separated by underscores, prefixed by
 * the toolkit name (`GITHUB_`). Examples: `GITHUB_GET_A_REPOSITORY`,
 * `GITHUB_LIST_PULL_REQUESTS`.
 */
export const GITHUB_TOOL_SLUG_REGEX = /^GITHUB_[A-Z][A-Z0-9_]*$/

/**
 * Maximum number of enabled tool slugs we persist for a project. Composio's
 * full GitHub toolkit currently exposes ~500 tools; 500 is a permissive cap
 * that still bounds storage.
 */
export const GITHUB_TOOLS_ENABLED_MAX = 500

/**
 * Normalizes a list of GitHub tool slugs intended to be enabled for a project.
 *
 * Performs the following operations:
 *  1. Skips non-string entries silently (defensive — the API route validates
 *     shape upstream, but this normalizer is the last line of defense before
 *     persistence).
 *  2. Trims whitespace.
 *  3. Drops entries that don't match `GITHUB_TOOL_SLUG_REGEX`.
 *  4. Drops entries on the hard-deny list (see
 *     `src/server/tools/github-tools-hard-deny.ts`).
 *  5. Deduplicates (Set preserves insertion order; subsequent sort makes
 *     output deterministic regardless).
 *  6. Sorts alphabetically.
 *  7. Caps at `GITHUB_TOOLS_ENABLED_MAX` entries.
 *
 * Silently drops invalid input rather than throwing — the caller (the
 * PATCH route) is expected to validate shape upstream; this normalizer is
 * defense-in-depth, not the primary validator.
 *
 * @param slugs - Array of candidate slugs (typed as readonly string[], but
 *   defensively handles non-string elements).
 * @returns Sorted, deduped, validated, and capped array of slugs.
 */
export function normalizeGithubToolsEnabled(slugs: readonly string[]): string[] {
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return []
  }

  const kept: string[] = []
  for (const entry of slugs) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!GITHUB_TOOL_SLUG_REGEX.test(trimmed)) continue
    if (isHardDeniedGithubTool(trimmed)) continue
    kept.push(trimmed)
  }

  const deduped = Array.from(new Set(kept))
  deduped.sort()
  return deduped.slice(0, GITHUB_TOOLS_ENABLED_MAX)
}
