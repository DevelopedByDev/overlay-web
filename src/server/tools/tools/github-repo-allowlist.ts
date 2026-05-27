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
 * Slugs that legitimately operate without a repo coordinate (account-scoped
 * queries against the connected user, not a specific repository). For these,
 * a null extractor result is "this tool has no repo to validate" — delegate
 * to the original execute. Every other GITHUB_* tool is treated as
 * repo-required: null extractor → default-deny.
 *
 * After Fix 1 + Fix 2 the curated chat toolset contains NO entries from this
 * set. The set is intentionally retained as the safe forward-compat seam:
 * if a future tool genuinely has no repo arg (e.g. GITHUB_GET_AUTHENTICATED_USER)
 * it must be listed here explicitly. The default is deny.
 */
const NON_REPO_SCOPED_GITHUB_TOOLS = new Set<string>([
  // Currently empty by design — see comment above. Phase B additions go here.
])

/**
 * Returns true when the tool name MUST receive a parseable repo coordinate
 * (default-deny on extractor null). The non-repo-scoped allowlist is the
 * inverse: if the name appears in {@link NON_REPO_SCOPED_GITHUB_TOOLS},
 * the call is delegated to the original execute on extractor null.
 */
function isRepoRequiredGithubTool(name: string): boolean {
  return isGithubComposioTool(name) && !NON_REPO_SCOPED_GITHUB_TOOLS.has(name)
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
 * Fork/transfer destination detection lives at the call site in
 * applyGithubRepoAllowlistToTools (it dispatches on the tool name).
 *
 * @param input - The tool arguments (treated defensively as unknown)
 * @returns An object with { owner: string; name: string } or null
 */
export function extractRepoFromComposioGithubArgs(
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

/**
 * Extracts the fork/transfer target repo from Composio GitHub tool arguments.
 * Used for GITHUB_FORK_* and GITHUB_*_TRANSFER_* tools where both the source
 * and the destination must be on the allowlist.
 *
 * Recognizes target_owner + target_repo fields.
 * Returns null if no fork target is present in the input.
 *
 * @param input - The tool arguments (treated defensively as unknown)
 * @returns An object with { owner: string; name: string } or null
 */
function extractForkTargetFromComposioGithubArgs(
  input: unknown,
): { owner: string; name: string } | null {
  if (input === null || typeof input !== 'object') {
    return null
  }

  const obj = input as Record<string, unknown>

  if (typeof obj.target_owner === 'string' && typeof obj.target_repo === 'string') {
    if (obj.target_owner && obj.target_repo) {
      return {
        owner: obj.target_owner.trim().toLowerCase(),
        name: obj.target_repo.trim().toLowerCase(),
      }
    }
  }

  return null
}

/**
 * A per-project GitHub repository access policy.
 *
 * `enabled` is true when a project-scoped repository list is available,
 * including an empty list. An empty list means no repositories are linked.
 * When disabled, all repos are allowed unconditionally (used only for
 * non-project/unavailable policy paths).
 *
 * `allows` performs a case-insensitive lookup: both the target and the list
 * entries are compared in lowercased "owner/name" form.
 */
export type GithubRepoPolicy = {
  /** Whether the repository policy is active. True when a list was provided. */
  readonly enabled: boolean
  /** The raw allowlist entries as supplied by the project owner. */
  readonly list: readonly string[]
  /**
   * Returns true if the target repo is in the allowlist.
   *
   * @param target - { owner, name } both already lowercased
   */
  allows(target: { owner: string; name: string }): boolean
}

/**
 * Builds a {@link GithubRepoPolicy} from a project's allowlist configuration.
 *
 * @param list - An array of "owner/repo" strings, or undefined (policy off)
 * @returns A policy object with an `allows` method for fast case-insensitive lookup
 */
export function buildGithubRepoPolicy(list: readonly string[] | undefined): GithubRepoPolicy {
  // Defense-in-depth: even though the normalizer is the authoritative
  // validation step (HTTP and Convex mutation paths both go through it),
  // a malformed entry that bypassed normalization (e.g. direct DB write,
  // future call site error) would silently sit in the set and never match
  // a "owner/name" lookup — converting an intended-allowed repo into an
  // effective deny. Filter to exactly "owner/name" shape here so the
  // chokepoint never surprises the operator.
  const enabled = list !== undefined
  const safeList: readonly string[] = (list ?? []).filter((entry) => {
    if (typeof entry !== 'string') return false
    const slashes = entry.match(/\//g)?.length ?? 0
    if (slashes !== 1) return false
    const [owner, name] = entry.split('/')
    return Boolean(owner && name)
  })

  // Pre-compute a lowercased set for O(1) lookup
  const lowercasedSet = new Set(safeList.map((entry) => entry.toLowerCase()))

  return {
    enabled,
    list: safeList,
    allows(target: { owner: string; name: string }): boolean {
      if (!enabled) return true
      const key = `${target.owner.toLowerCase()}/${target.name.toLowerCase()}`
      return lowercasedSet.has(key)
    },
  }
}

/**
 * The structured refusal payload returned when a GitHub tool call is blocked
 * by the repo allowlist policy.
 */
export type RepoBlockedToolResult = {
  ok: false
  error: 'repo_not_in_allowlist'
  blockedRepo: string
  allowedRepos: readonly string[]
  message: string
}

/**
 * Builds the structured refusal payload for a blocked GitHub tool call.
 *
 * The returned object is safe to pass directly to the AI SDK as a tool result —
 * it NEVER throws. The model can read the message and self-correct.
 *
 * @param args.toolName - The name of the blocked tool
 * @param args.target - The { owner, name } of the blocked repository
 * @param args.allowed - The policy's allowlist
 * @returns A {@link RepoBlockedToolResult}
 */
export function buildRepoBlockedToolResult(args: {
  toolName: string
  target: { owner: string; name: string }
  allowed: readonly string[]
}): RepoBlockedToolResult {
  const blockedRepo = `${args.target.owner}/${args.target.name}`
  const allowedSummary = args.allowed.join(', ') || '(none)'
  return {
    ok: false,
    error: 'repo_not_in_allowlist',
    blockedRepo,
    allowedRepos: args.allowed,
    message: `Repository '${blockedRepo}' is not in this project's allowed list. Allowed: ${allowedSummary}. Ask the project owner to add it in project Settings if needed.`,
  }
}

/**
 * Wraps each GITHUB_* tool in `toolSet` with an allowlist enforcement layer.
 *
 * Security guarantees:
 * - If the policy is disabled (`policy.enabled === false`), returns `toolSet`
 *   BY IDENTITY — no copies, no overhead.
 * - For every GITHUB_* tool with an `execute` function, the wrapped execute:
 *   1. Parses the target repo from the arguments using the precedence extractor.
 *   2. If no repo is found (e.g. GITHUB_LIST_USER_ORGANIZATIONS), delegates to
 *      the original execute unchanged.
 *   3. For fork/transfer tools (name contains `_FORK_` or `_TRANSFER_`), ALSO
 *      checks the destination repo. Both source and target must be on the list.
 *   4. If allowed, delegates to original.
 *   5. If blocked, returns a {@link RepoBlockedToolResult} WITHOUT calling the
 *      original execute. Composio's outbound HTTP call lives inside that
 *      original, so non-invocation is the zero-egress proof.
 * - Non-GITHUB_* tools are copied by reference (object identity preserved).
 *
 * The generic `T` preserves the caller's toolset typing end-to-end.
 *
 * @param toolSet - The toolset to wrap
 * @param policy - The repo allowlist policy
 * @returns The wrapped toolset (or the original if policy is disabled)
 */
export function applyGithubRepoAllowlistToTools<T extends Record<string, unknown>>(
  toolSet: T,
  policy: GithubRepoPolicy,
): T {
  // Fast path: policy off → identity return (tests assert object identity)
  if (!policy.enabled) {
    return toolSet
  }

  const result = {} as Record<string, unknown>

  for (const [name, tool] of Object.entries(toolSet)) {
    // Non-GitHub tools pass through by reference
    if (!isGithubComposioTool(name)) {
      result[name] = tool
      continue
    }

    // Tools without execute (malformed) pass through by reference
    if (
      tool === null ||
      typeof tool !== 'object' ||
      typeof (tool as Record<string, unknown>).execute !== 'function'
    ) {
      result[name] = tool
      continue
    }

    const originalTool = tool as Record<string, unknown>
    const originalExecute = originalTool.execute as (
      input: unknown,
      ctx: unknown,
    ) => Promise<unknown>

    const isForkOrTransfer = name.includes('_FORK_') || name.includes('_TRANSFER_')

    const wrappedExecute = async (input: unknown, ctx: unknown): Promise<unknown> => {
      const sourceTarget = extractRepoFromComposioGithubArgs(input)

      // Null extractor result. Two cases:
      // 1. The tool is in NON_REPO_SCOPED_GITHUB_TOOLS (account-scoped op,
      //    e.g. GITHUB_GET_AUTHENTICATED_USER) — delegate to original.
      // 2. The tool is repo-required and the args were not parseable into a
      //    repo coord (e.g. percent-encoded slash that splits to length 1,
      //    missing fields, unknown shape) — default-deny. Composio's HTTP
      //    layer may still construct a valid request from the raw input via
      //    URL decoding or unknown field handling, so the wrap MUST refuse
      //    rather than delegate.
      if (sourceTarget === null) {
        if (!isRepoRequiredGithubTool(name)) {
          return originalExecute(input, ctx)
        }
        console.warn('[github-allowlist] blocked', JSON.stringify({
          toolName: name,
          blockedRepo: null,
          reason: 'repo-arg-missing-or-unparseable',
        }))
        return buildRepoBlockedToolResult({
          toolName: name,
          target: { owner: '(unparseable)', name: '(unparseable)' },
          allowed: policy.list,
        })
      }

      // Check source repo
      if (!policy.allows(sourceTarget)) {
        // Structured log for support / observability. Searchable via the
        // [github-allowlist] prefix; one line per blocked call so log volume
        // remains bounded by the model's tool-call rate (already governed).
        console.warn('[github-allowlist] blocked', JSON.stringify({
          toolName: name,
          blockedRepo: `${sourceTarget.owner}/${sourceTarget.name}`,
          reason: 'source-not-in-allowlist',
        }))
        return buildRepoBlockedToolResult({
          toolName: name,
          target: sourceTarget,
          allowed: policy.list,
        })
      }

      // For fork/transfer tools, also validate the destination repo.
      // Default-deny: if the target fields are missing, GitHub would fork to
      // the caller's default account (outside the allowlist). Block in that
      // case too — require an explicit target that is itself on the list.
      if (isForkOrTransfer) {
        const forkTarget = extractForkTargetFromComposioGithubArgs(input)
        if (forkTarget === null || !policy.allows(forkTarget)) {
          console.warn('[github-allowlist] blocked', JSON.stringify({
            toolName: name,
            blockedRepo: forkTarget
              ? `${forkTarget.owner}/${forkTarget.name}`
              : `${sourceTarget.owner}/${sourceTarget.name}`,
            reason: forkTarget ? 'target-not-in-allowlist' : 'fork-target-missing',
          }))
          return buildRepoBlockedToolResult({
            toolName: name,
            target: forkTarget ?? sourceTarget,
            allowed: policy.list,
          })
        }
      }

      return originalExecute(input, ctx)
    }

    result[name] = { ...originalTool, execute: wrappedExecute }
  }

  return result as T
}
