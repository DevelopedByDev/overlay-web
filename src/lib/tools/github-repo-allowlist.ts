/**
 * Predicate to check if a Composio tool name is a GitHub tool.
 *
 * @param name - The tool name to check
 * @returns true if the name starts with 'GITHUB_', false otherwise
 */
export function isGithubComposioTool(name: string): boolean {
  return name.startsWith('GITHUB_')
}

/**
 * Extracts the owner and repo name from Composio GitHub tool arguments.
 *
 * Handles heterogeneous argument shapes by trying these precedence rules (in order):
 * 1. input.full_name (string, split on "/")
 * 2. input.repo_full_name (string, split on "/")
 * 3. input.owner (string) + input.repo (string)
 * 4. input.owner (string) + input.name (string)
 * 5. input.repository (string, split on "/")
 *
 * Both owner and name are trimmed and lowercased before returning.
 * Returns null if the input is not an object or no valid repo arguments are found.
 *
 * @param toolName - The Composio tool name (used for precedence hints, unused currently)
 * @param input - The tool arguments (treated defensively as unknown)
 * @returns An object with { owner: string; name: string } or null
 */
export function extractRepoFromComposioGithubArgs(
  toolName: string,
  input: unknown,
): { owner: string; name: string } | null {
  // Defensive: only proceed if input is an object
  if (input === null || typeof input !== 'object') {
    return null
  }

  const obj = input as Record<string, unknown>

  // Rule 1: full_name (e.g., "octocat/Hello")
  if (typeof obj.full_name === 'string') {
    const parts = obj.full_name.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        owner: parts[0].trim().toLowerCase(),
        name: parts[1].trim().toLowerCase(),
      }
    }
  }

  // Rule 2: repo_full_name (e.g., "octocat/Hello")
  if (typeof obj.repo_full_name === 'string') {
    const parts = obj.repo_full_name.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        owner: parts[0].trim().toLowerCase(),
        name: parts[1].trim().toLowerCase(),
      }
    }
  }

  // Rule 3: owner + repo
  if (typeof obj.owner === 'string' && typeof obj.repo === 'string') {
    if (obj.owner && obj.repo) {
      return {
        owner: obj.owner.trim().toLowerCase(),
        name: obj.repo.trim().toLowerCase(),
      }
    }
  }

  // Rule 4: owner + name
  if (typeof obj.owner === 'string' && typeof obj.name === 'string') {
    if (obj.owner && obj.name) {
      return {
        owner: obj.owner.trim().toLowerCase(),
        name: obj.name.trim().toLowerCase(),
      }
    }
  }

  // Rule 5: repository (e.g., "octocat/Hello")
  if (typeof obj.repository === 'string') {
    const parts = obj.repository.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        owner: parts[0].trim().toLowerCase(),
        name: parts[1].trim().toLowerCase(),
      }
    }
  }

  // No matching rule found
  return null
}
