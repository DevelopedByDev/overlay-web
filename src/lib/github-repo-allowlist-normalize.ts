/**
 * Regex pattern for validating GitHub repo allowlist entries in the form owner/name.
 * - Owner: starts with lowercase letter or digit, followed by lowercase letters, digits, or hyphens
 * - Slash separator
 * - Repo: lowercase letters, digits, dots, underscores, or hyphens
 */
export const GITHUB_REPO_ALLOWLIST_REGEX = /^[a-z0-9][a-z0-9-]*\/[a-z0-9._-]+$/

/**
 * Normalizes a list of GitHub repository allowlist entries.
 *
 * Performs the following operations in order:
 * 1. Trims whitespace from each entry
 * 2. Lowercases each entry
 * 3. Validates each entry against the regex pattern (throws if invalid)
 * 4. Deduplicates entries (keeps first occurrence after normalization)
 * 5. Sorts lexicographically
 * 6. Slices to the first 100 entries
 *
 * @param repos - Array of repository strings in the form "owner/repo"
 * @returns Normalized and validated array of repository strings
 * @throws Error if any entry fails validation (error message includes the raw input)
 *
 * @example
 * const result = normalizeGithubRepoAllowlist(['Acme/Web', 'b/a', 'acme/web'])
 * // Returns: ['acme/web', 'b/a']
 */
export function normalizeGithubRepoAllowlist(repos: string[]): string[] {
  if (repos.length === 0) {
    return []
  }

  // Step 1 & 2: Trim and lowercase
  const trimmedAndLowercased = repos.map((repo) => repo.trim().toLowerCase())

  // Step 3: Validate each entry
  for (const repo of trimmedAndLowercased) {
    if (!GITHUB_REPO_ALLOWLIST_REGEX.test(repo)) {
      // Find the original raw input for the error message
      const originalIndex = trimmedAndLowercased.indexOf(repo)
      const rawInput = repos[originalIndex]
      throw new Error(
        `Repository entry is malformed: "${rawInput}" (normalized to "${repo}")`,
      )
    }
  }

  // Step 4: Deduplicate (keep first occurrence)
  const deduplicated = Array.from(new Set(trimmedAndLowercased))

  // Step 5: Sort lexicographically
  const sorted = deduplicated.sort()

  // Step 6: Slice to first 100 entries
  return sorted.slice(0, 100)
}
