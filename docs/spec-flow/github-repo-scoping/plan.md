# Architecture Plan: GitHub Repository Scoping for Projects

Status: Phase 2 (Plan). Anchors spec.md and clarify.md decisions to the current
codebase as of base commit `fea6917` on branch `spec-flow/github-repo-scoping`.

---

## 0. Baseline reality check (must read first)

Before designing, I verified the current code on this worktree:

- `convex/schema.ts` — `projects` table exists at lines 293–305 with
  `userId, clientId, name, instructions, parentId, createdAt, updatedAt,
  deletedAt`. **No `enabledIntegrationSlugs` field exists**, despite the
  Phase 1 prompt referencing it. There is no per-project toolkit-level
  scoping today. This feature does not depend on that field; it stands
  alone.
- `convex/projects.ts` — `create`/`update`/`get`/`list`/`remove` exist;
  there is **no `setEnabledIntegrations` mutation**. We will mirror the
  validation/auth style of `update` (lines 95–137).
- `src/lib/tools/composio-filter.ts` — exposes `filterComposioToolSet`
  (identity) and `filterComposioToolSetForPaidOnlyFeatures`. **No
  `filterComposioToolSetByProjectAllowlist` exists.** We intentionally
  will **not** put per-call repo enforcement into this file: it operates
  on the whole `ToolSet` shape with no per-call argument access.
- `src/lib/composio-tools.ts` — `createBrowserUnifiedTools` already wraps
  every Composio tool's `execute` (lines 169–184) to normalize
  `session_id`. This is the exact integration point we need.
- `src/app/api/app/conversations/act/route.ts` — uses
  `ToolLoopAgent` from `ai@^6.0.116` (lines 1168–1202). The stream-level
  callbacks `experimental_onToolCallStart` / `experimental_onToolCallFinish`
  are observers, **not interceptors** — they cannot cancel a call or
  rewrite the tool result. Confirmed from `node_modules/ai/dist/index.d.ts`:
  the only blocking-capable surface is per-tool `execute`.
- `packages/overlay-app-core/src/projects.ts` — `ProjectHubTab` is
  `'chats' | 'files' | 'instructions'`. **There is no 'settings' tab**;
  we will add one (or attach the picker to the Instructions tab; see §6).
- Test convention — `node:test` + `node:assert/strict`, executed by
  dynamic `import(new URL('./x.ts', import.meta.url).href)` (see
  `src/lib/tools/exposure-policy.test.ts`).

The plan below treats the spec/clarify text as the source of truth for
behavior and uses what is actually in the tree for shape and integration
points.

---

## 1. Architecture overview

### Single most important decision

**Enforcement lives in a per-tool `execute` wrapper, applied inside
`createBrowserUnifiedTools` (`src/lib/composio-tools.ts`), driven by a
small project-scoped policy object resolved at the start of each chat
turn in `src/app/api/app/conversations/act/route.ts`.** No other layer
gets to refuse a GitHub tool call; this is the single chokepoint.

### Why here, not elsewhere

The five candidate layers, with trade-offs:

1. **Composio SDK layer** (proxy `composio.tools()` output) — Composio
   doesn't expose a hook for this and our SDK shape is opaque-ish; we
   already wrap `execute` here for `session_id`, so reusing the wrapper
   slot is the path of least invention.
2. **`composio-filter.ts`** — operates over the static `ToolSet`. It
   cannot see arguments; it can only include/exclude tools. Stripping
   GitHub tools entirely would force a coarse "all-or-nothing" model
   per turn that contradicts the inclusive-list design.
3. **AI SDK middleware** (`wrapLanguageModel`) — wraps the model, not
   the tool execution. Wrong layer; tool calls are dispatched by the
   agent after the model returns a tool call.
4. **`ToolLoopAgent` stream callbacks** —
   `experimental_onToolCallStart/Finish` are observers (we already use
   them for logging at `act/route.ts:1225, 1235`). The AI SDK v6 surface
   in this tree provides **no `prepareStep` / `experimental_prepareTool`
   / abort hook** that lets us cancel a call before egress and inject a
   tool result. The exact mistake the orchestrator warned about.
5. **GitHub API egress proxy** — we don't proxy Composio's outbound
   GitHub calls; refusing here would require building one, which is
   wildly out of scope.

The `execute`-wrap layer is the only place where (a) we see the actual
arguments the model is sending, (b) we can return a structured tool
result without making any outbound request, and (c) the AI SDK accepts
our return value as the official tool output for that call. It is the
single chokepoint demanded by Success Criterion 1 ("zero network egress
for a blocked call").

### Trade-offs respected

- **DRY** — reuse the existing `execute`-wrap slot in `composio-tools.ts`
  instead of adding a second wrapping pass elsewhere. Reuse
  `authorizeUserAccess` (`convex/projects.ts:6`) for the new mutation.
  Reuse `resolveAuthenticatedAppUser` for the new HTTP route.
- **YAGNI** — `owner/name` string storage only (clarify Q5). No
  generalization to other toolkits (spec non-goal). No
  GitHub-tool-name catalog; we infer repo from arguments by name
  precedence and treat tools without a recognizable repo argument as
  "not a repo-scoped operation" → allowed.
- **KISS** — one field on `projects`. One mutation. One picker route.
  One enforcement function exported by one new file. The wrap is one
  loop addition in `composio-tools.ts`.

### What stays the same

- Composio cache TTL behavior in `createBrowserUnifiedTools` is
  unchanged — the cache stores raw tool definitions, and the wrap is
  per-turn (we cannot cache an `execute` closure that captures
  per-turn `allowedRepos`). Concretely: we keep the existing cache of
  the raw Composio tool set, and apply the allowlist wrap **after**
  retrieving from cache, in `act/route.ts`, once per turn. This means
  the per-turn wrap is microseconds, not the 700–1000 ms Composio init.

---

## 2. Data model

### Convex schema change

File: `convex/schema.ts`. In the `projects` table (lines 293–305), add:

```ts
githubRepoAllowlist: v.optional(v.array(v.string())),
```

- **Type:** `array<string>` of `"owner/name"` strings.
- **Optionality:** optional. `undefined` and `[]` both mean
  "permissive" (clarify Q1 + Story 3 backward compatibility). The
  distinction is preserved in case we ever want to disambiguate
  "never configured" from "actively cleared" for UX, but the
  enforcement path treats them identically.
- **Sibling table vs. inline:** inline on `projects`. A separate table
  would require a join on every chat turn and per-mutation transactional
  housekeeping for a single, small, owner-scoped array. The expected
  list size is small (< 100 in v1). Inline wins on KISS and read
  latency; existing project read code (`convex/projects.ts:50, 36`)
  picks it up for free.
- **Justification for the type:** lowercase `owner/name` is what
  GitHub uses canonically and what Composio's tools accept as
  arguments. Numeric IDs (clarify Q5 option B/C) were rejected as
  YAGNI.

### Validation rules

Implemented in (1) the new Convex mutation and (2) the new HTTP route
handler — same regex in both for defense in depth.

- **Regex:** `/^[a-z0-9][a-z0-9-]*\/[a-z0-9._-]+$/`
  - Owner: GitHub-style (start alphanumeric, allow hyphens).
  - Name: GitHub allows `[A-Za-z0-9._-]+`.
- **Normalization:** trim, lowercase. Composio tool arguments may
  arrive with mixed case (e.g. `Microsoft/TypeScript`); storing
  lowercase and comparing lowercase eliminates the case mismatch
  bug class. Document this in the picker UI ("repositories are
  matched case-insensitively").
- **Dedupe:** sorted unique on write.
- **Max length:** cap per entry at 100 chars (5 + 1 + 100 well under
  GitHub's actual 39/100 limit). Cap the array length at **100** to
  prevent runaway documents. If a user has > 100 repos to allow, the
  current `enabledIntegrationSlugs` story (entire toolkit on/off) is
  the right tool.
- **Reject mutations** that fail validation with a structured error
  message naming the offending entry; do not silently drop entries.

---

## 3. Backend layers — read & write paths

### Convex layer

File: `convex/projects.ts`.

Add one new mutation, mirroring the auth + project-ownership style of
`update` (lines 95–137):

```ts
export const setGithubRepoAllowlist = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    repos: v.array(v.string()),
  },
  handler: async (ctx, { projectId, userId, accessToken, serverSecret, repos }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const project = await ctx.db.get(projectId)
    if (!project || project.userId !== userId) throw new Error('Unauthorized')
    const normalized = normalizeGithubRepoAllowlist(repos) // shared util, see §10
    await ctx.db.patch(projectId, {
      githubRepoAllowlist: normalized.length > 0 ? normalized : undefined,
      updatedAt: Date.now(),
    })
    return normalized
  },
})
```

- Returns the normalized list so the client can update its store with
  the exact server-side representation (deduped, lowercased, sorted).
- Storing `undefined` when `normalized.length === 0` keeps existing
  permissive-default rows identical to pre-feature shape (Story 3).

The existing `projects:get` query returns the full doc, so the picker
can read `githubRepoAllowlist` directly without a new query.

No change to `projects:create` — newly created projects are permissive
by default (clarify Q1).

### HTTP layer

File: `src/app/api/app/projects/route.ts`. Extend the existing PATCH
handler (lines 93–125) to accept an optional `githubRepoAllowlist`
field. When present, call the new mutation; otherwise leave the field
untouched. This keeps the API surface to one route.

Request body addition:

```ts
githubRepoAllowlist?: string[]
```

Response: unchanged shape (`{ success: true, project }`). The picker
re-reads the project from the returned `project` field; no separate
GET.

Auth: reuse `resolveAuthenticatedAppUser` already in use at line 103;
unchanged.

### Repo-list HTTP route (for the picker) — see §5

---

## 4. Enforcement at tool-call time

### Where

- **New file:** `src/lib/tools/github-repo-allowlist.ts`.
- **Wrap point:** `src/lib/composio-tools.ts`, inside
  `buildBrowserUnifiedTools` — but the wrap **cannot** capture a
  per-turn `allowedRepos` value because the result is cached per-user
  for 10 minutes (line 142). Instead:
  - Keep `createBrowserUnifiedTools` returning the unscoped, cached
    tool set.
  - Add a new exported function `applyGithubRepoAllowlistToTools(toolSet,
    policy)` in `github-repo-allowlist.ts`, called per-turn in
    `src/app/api/app/conversations/act/route.ts` right after the
    existing `filterComposioToolSetForPaidOnlyFeatures` call
    (line 1064–1067).

### How interception works (AI SDK ^6.0.116 verified)

Every tool definition is an object with an `execute(input, options)`
function. The agent invokes `execute` directly; whatever it returns
becomes the `tool` message the model sees next step. So:

```ts
// github-repo-allowlist.ts (abridged — full file is ~150 LOC)
export function applyGithubRepoAllowlistToTools(
  toolSet: ToolSet,
  policy: GithubRepoPolicy,
): ToolSet {
  if (!policy.enabled) return toolSet
  const wrapped: ToolSet = {}
  for (const [name, def] of Object.entries(toolSet)) {
    if (!isGithubComposioTool(name) || !def || typeof def !== 'object') {
      wrapped[name] = def
      continue
    }
    const originalExecute = (def as { execute?: unknown }).execute
    if (typeof originalExecute !== 'function') { wrapped[name] = def; continue }
    wrapped[name] = {
      ...def,
      execute: async (input, options) => {
        const target = extractRepoFromComposioGithubArgs(name, input)
        if (target && !policy.allows(target)) {
          return buildRepoBlockedToolResult({ toolName: name, target, allowed: policy.list })
        }
        return (originalExecute as ToolExecuteFunction<any, any>)(input, options)
      },
    }
  }
  return wrapped
}
```

- `isGithubComposioTool(name)` — name-prefix check. All Composio
  GitHub tools start with `GITHUB_`. Safe, well-defined, no external
  catalog needed.
- `extractRepoFromComposioGithubArgs(toolName, input)` — see below.
- If `target` is `null` (no repo arg recognized), we **allow** the
  call. A non-repo-scoped operation (e.g.
  `GITHUB_LIST_USER_ORGANIZATIONS`) is not a target the allowlist
  governs; blocking it would surprise users. This is a deliberate
  scope decision — the spec governs "repo-scoped" operations, and
  org listings, profile lookups, etc. are not.

### Parsing the repo argument

`extractRepoFromComposioGithubArgs(toolName, input)` returns
`{ owner: string, name: string }` or `null`. Resolution precedence:

1. `input.full_name` (string) — split on `/`.
2. `input.repo_full_name` (string) — split on `/`.
3. `input.owner` + `input.repo` (both strings).
4. `input.owner` + `input.name` (both strings).
5. `input.repository` (string containing `/`) — split.
6. Tools whose name contains `_FORK_` or `_TRANSFER_` may carry a
   `target_owner` / `target_repo`; if present, require **both** the
   source AND the target to be on the allowlist (more conservative;
   forking into an unowned target is still cross-contamination).
7. None of the above → `null` (allow).

Strings are trimmed and lowercased before comparison. Comparison is
exact `owner/name` equality on the normalized form.

This rule list is the entire heuristic; it is not a per-tool table.
The list is unit-tested with representative payloads for the most
common Composio GitHub tools (see §9).

### Refusal payload shape

```ts
{
  ok: false,
  error: 'repo_not_in_allowlist',
  blockedRepo: 'octocat/hello',
  allowedRepos: ['acme/web', 'acme/api'],
  message:
    "Repository 'octocat/hello' is not in this project's allowed list. " +
    "Allowed: acme/web, acme/api. Ask the project owner to add it in " +
    "project Settings if needed."
}
```

- Plain object (Composio tool results are arbitrary JSON), so the
  model receives it as a normal tool result and can self-correct
  (Story 2).
- `ok: false` is a convention; the AI SDK does not interpret this
  specially. We do NOT `throw` — throwing would crash the step and
  hit `experimental_onToolCallFinish` with `success: false`, which is
  reserved for genuine failures and would be billed against the
  user's error budget for retries.

### Zero-egress guarantee

The wrapper short-circuits **before** calling the original `execute`.
Composio's actual outbound HTTP happens inside that original
`execute`. By returning the refusal object without invoking it, we
provably make zero outbound network requests for a blocked call.
This is asserted in the unit test plan in §9.

### Policy object resolution per turn

In `act/route.ts`, around the existing project fetch
(`projectTask`, lines 843–855), extend the query to also pull
`githubRepoAllowlist`. Then build:

```ts
const githubRepoPolicy = buildGithubRepoPolicy(project?.githubRepoAllowlist)
// {
//   enabled: list.length > 0,
//   list,                                  // string[]
//   allows: (r: {owner,name}) => boolean,  // case-insensitive set lookup
// }
```

Apply after the existing paid-only filter (line 1064):

```ts
const composioTools = applyGithubRepoAllowlistToTools(
  filterComposioToolSetForPaidOnlyFeatures(filterComposioToolSet(composioRaw), paid),
  githubRepoPolicy,
)
```

When `enabled === false`, `applyGithubRepoAllowlistToTools` is a no-op
identity (Story 3 backward compat path).

---

## 5. Repo list endpoint (for the picker)

### New HTTP route

File: `src/app/api/app/integrations/github/repositories/route.ts`.
A new file under the existing integrations API rather than overloading
the existing `/api/app/integrations` route, because the existing route
already has heavy GET branching for `action=search` and per-app
metadata fetches. Adding a third branch makes that file 350+ LOC,
violating the project's size guardrails.

GET handler:

```ts
GET /api/app/integrations/github/repositories?cursor=<opaque>&limit=<n>
→ { items: [{ fullName: 'owner/name', private: boolean, archived?: boolean }],
    nextCursor: string | null,
    error?: 'github_not_connected' | 'fetch_failed' | 'rate_limited' }
```

- Auth: `resolveAuthenticatedAppUser` (same as other app API routes).
- Calls Composio's `LIST_REPOSITORIES` action through the existing
  Composio SDK loader pattern in `src/app/api/app/integrations/route.ts:22–36`
  (reused via a small shared util — see §10) and returns the user-
  scoped repo list. Composio's pagination is opaque-cursor; pass it
  through.
- Limit: default 100, max 200 per page. The picker loads pages lazily
  on scroll (UI keeps a flat search-filterable list).
- Failure mode: if the Composio call throws or returns 4xx/5xx, the
  route returns `{ items: [], nextCursor: null, error: 'fetch_failed' }`
  with HTTP 200. The UI then surfaces the manual-entry fallback
  (clarify Q4 option C). HTTP 200 keeps the response easy for the
  client; the typed `error` field is the contract.
- If GitHub is not connected for this user (no Composio account on
  toolkit `github`), return `{ items: [], nextCursor: null, error:
  'github_not_connected' }`. The UI must already know this from the
  parent component (visibility rule, §6), but the route is defensive.

### Cache policy

- **None across requests.** Repos a user can see in GitHub can change
  any time; caching a stale list is a correctness risk for a security
  feature.
- **Per-request memoization is intrinsic** (the route handler does one
  Composio call per HTTP request).
- A future optimization could short-TTL cache (~30 s) keyed by
  `userId`, but it is explicitly YAGNI in v1.

### Response shape consumed by the picker

```ts
type GithubRepositoryListResponse = {
  items: Array<{ fullName: string; private?: boolean; archived?: boolean }>
  nextCursor: string | null
  error?: 'github_not_connected' | 'fetch_failed' | 'rate_limited'
}
```

`fullName` is the canonical `owner/name` string, already lowercased
by the route handler before returning, so the UI never has to
normalize.

### Typed client surface

Add to `packages/overlay-api-client/src/index.ts` `integrations` block
(around line 454–482):

```ts
github: {
  listRepositories: (query?: { cursor?: string; limit?: number }, init?: RequestInit) =>
    json<GithubRepositoryListResponse>(githubRepoListPath(query), init),
}
```

Mirrors existing typed-client conventions.

---

## 6. UI — repo picker in project settings

### Component placement decision (deviation from spec wording)

The spec says "open a project's Settings tab". **There is no Settings
tab on this branch** — `ProjectHubTab = 'chats' | 'files' |
'instructions'` (`packages/overlay-app-core/src/projects.ts:9`).

Two viable approaches:

- **A. Add a new `'settings'` tab to `ProjectHubTab`** (the literal
  spec reading). Adds a fourth tab to the project hub for one
  setting in v1. Future-proof but bigger UI surface change.
- **B. Render the picker beneath the existing Instructions tab**, as
  a separate section labeled "Integrations". Lower-friction; reuses
  the existing tab; matches the spec's deeper intent ("next to the
  existing integration toggles"). The current branch has no
  per-project integration toggles to be "next to", so the picker
  stands on its own.

**Recommendation: A — add a `'settings'` tab.** Mixing integration
scoping with prose instructions in the same scrollable area is
confusing and will lose discoverability the moment a second
per-project setting is added. The cost of one extra tab button is
small, and Story 1's acceptance criterion ("open a project's
Settings tab") reads as load-bearing language for this feature.

This is the only deviation from the literal spec wording — surfaced
here so the orchestrator can override.

### Component file paths

- New: `packages/overlay-modules-react/src/projects-settings.tsx`
  - Exports `ProjectSettingsTabContent`.
  - Renders the `GithubRepoAllowlistPicker` child component.
  - Reasoning: keeps `projects.tsx` (1524 LOC) from growing further
    — it is already past the project's 350 LOC soft cap.
- New: `packages/overlay-modules-react/src/github-repo-picker.tsx`
  - Exports `GithubRepoAllowlistPicker` (presentational), accepts
    props `{ value, options, loading, error, onChange, onAddManual,
    onRetryLoad, manualEntry }`. Single responsibility.
- Modified: `packages/overlay-app-core/src/projects.ts`
  - Add `'settings'` to `ProjectHubTab` union.
  - Add `GithubRepositoryOption` and `GithubRepoAllowlistDraftState`
    types and helpers (normalize, dedupe, validate manual entry).
- Modified: `packages/overlay-modules-react/src/projects.tsx` (lines
  1025–1148)
  - Add `'Settings'` tab button.
  - Render `<ProjectSettingsTabContent ... />` when tab is active.
- Modified: `src/components/app/ProjectsView.tsx`
  - Add data-fetching glue for the picker:
    - On entering Settings tab AND GitHub toolkit enabled → fetch
      via `overlayAppClient.integrations.github.listRepositories()`.
    - Wire save through `overlayAppClient.projects.update()` with
      the new `githubRepoAllowlist` field.
    - Local optimistic update; no page reload (Story 1 AC).

### Visibility rule (clarify Q9)

The picker is hidden when the GitHub toolkit is disabled for the
project. **Caveat (open question, see §11):** on the current branch
there is **no per-project GitHub-toolkit toggle**. So in v1 the
visibility rule reduces to: hide when **GitHub is not connected at
the user level** (i.e., the user has no Composio connected account
with `appName === 'github'`). When per-project toolkit toggles arrive
later, the rule becomes "hidden if either the user is not connected
OR the project has GitHub disabled".

We get the user-level connection status from
`overlayAppClient.integrations.get()` (already loaded by
`IntegrationsView.tsx:70–80`).

### Search / filter behavior

- Single text input, case-insensitive substring match against
  `fullName`.
- Picker is a checkbox list. Already-selected repos render at the
  top, even if not in the current search filter, so they cannot be
  "lost" by typing a query.
- Empty result of the filter shows a single line: "No matches. You
  can also type an `owner/name` and click Add to include a repo you
  don't see here."

### Loading / empty / error states

| Condition                            | UI |
|--------------------------------------|----|
| `loading === true`                   | Skeleton list with spinner |
| `items.length === 0 && !error`       | "No repositories found in your GitHub account." + manual-entry input always visible |
| `error === 'fetch_failed'`           | Warning banner + Retry button + manual-entry input visible |
| `error === 'github_not_connected'`   | Should not occur (component hidden) — defensive empty render |
| `value.length > 0 && all unselected` | "All repositories are accessible" hint (permissive default) |

### Manual entry fallback

A second always-visible row underneath the list:

```
[ owner/name________________ ]  [ Add ]
```

- Validates against the same regex as the server.
- On Add: pushes to `value` and clears the input.
- Manual entries are merged into `value` and saved like any other.

### Save / dirty / round-trip behavior

- Picker is controlled (`value` + `onChange`).
- `ProjectsView` holds a draft state and saves on **explicit Save**
  button (matches existing project-instructions flow at lines
  1129–1146). No autosave — avoids accidental overwrites mid-edit.
- After successful save, `value` reflects the server-side normalized
  response (so dedupe / lowercasing is visible immediately).
- Re-opening the project's Settings tab shows the saved list as
  selected (Success Criterion 7).

---

## 7. Agent context injection

### Where

In `src/app/api/app/conversations/act/route.ts`, inside the
`ToolLoopAgent` `instructions` string assembly (lines 1175–1201). The
existing pattern is a long-concatenated string of contextual notes.

Add a `githubRepoScopeNote` constant, included in the agent
`instructions` if and only if the policy is enabled (allowlist
non-empty):

```ts
const githubRepoScopeNote = githubRepoPolicy.enabled
  ? "\n\nGitHub repository scope: For this project you may only act on " +
    "the following GitHub repositories: " +
    githubRepoPolicy.list.join(', ') +
    ". Any GitHub tool call targeting another repository will be refused " +
    "by the system before reaching GitHub. Do not attempt operations on " +
    "other repositories."
  : ''
```

Insert it in the long concat (around `toolAuthorizationNote`,
line 1190) so it appears next to other tool-policy guidance and
before the verbose model-specific notes.

### Empty-allowlist behavior

When `githubRepoPolicy.enabled === false`, we **inject nothing**.
This prevents accidentally training users (or models) to expect the
note in the permissive default state, and keeps the system prompt
short. The model sees its full GitHub tool set with no special
mention, identical to today (Story 3).

### Exact wording

See snippet above. Kept short (1–2 sentences) to minimize token
overhead; long enough that the model knows the refusal is from "the
system" and not GitHub, so it self-corrects rather than retrying.

---

## 8. Error handling

| Condition                                        | User-facing? | Logging? | Behavior |
|--------------------------------------------------|--------------|----------|----------|
| Convex `setGithubRepoAllowlist` invalid entry    | Yes          | `info`   | HTTP 400 from PATCH with field-level message naming the bad entry |
| Convex `setGithubRepoAllowlist` Unauthorized     | Yes          | `warn`   | HTTP 401 (matches existing PATCH behavior) |
| Convex mutation failed (transient)               | Yes          | `error`  | HTTP 500; UI shows "Failed to save. Retry?" |
| `LIST_REPOSITORIES` returns 4xx/5xx              | No (banner)  | `warn`   | HTTP 200 `{ error: 'fetch_failed' }`; UI shows banner + manual entry |
| `LIST_REPOSITORIES` rate-limited                 | No (banner)  | `warn`   | HTTP 200 `{ error: 'rate_limited' }`; UI shows "Rate limited. Try again later." + manual entry |
| GitHub not connected (no Composio account)       | No           | `info`   | HTTP 200 `{ error: 'github_not_connected' }`; UI component hidden by parent; defensive empty render |
| Blocked tool call (enforcement)                  | Yes (to model) | `info` | **NOT thrown.** Returns structured refusal payload (§4). Logged once per blocked call with `{ projectId, toolName, blockedRepo }` for debuggability. |
| Composio SDK module import failure               | Yes          | `error`  | HTTP 500 from list-repos route; PATCH still works (no Composio dep) |
| User toggles a repo on but is no longer connected| No           | `info`   | Save succeeds (intent is preserved per clarify Q6); next chat turn shows the agent context but tools can't actually be invoked because Composio session has no auth — Composio will fail naturally |

The key invariant from Story 2: **a blocked tool call is a refusal
payload, never a thrown error**. The wrap function in
`github-repo-allowlist.ts` does not call `throw`. It also does not
swallow errors from the wrapped `originalExecute`; those propagate.

---

## 9. Testing approach

All tests use the existing convention (`node:test` +
`node:assert/strict`, dynamic `import(new URL(...).href)`).

### Unit (`*.test.ts` co-located in `src/lib/tools/`)

**New: `src/lib/tools/github-repo-allowlist.test.ts`**

Required cases:

1. `extractRepoFromComposioGithubArgs` resolves `full_name` form
   (`{ full_name: 'octocat/hello' }`) to `{owner:'octocat', name:'hello'}`.
2. `extractRepoFromComposioGithubArgs` resolves `owner` + `repo` form.
3. `extractRepoFromComposioGithubArgs` resolves `owner` + `name` form.
4. `extractRepoFromComposioGithubArgs` returns `null` for
   no-repo-arg tools (e.g. `GITHUB_LIST_USER_ORGANIZATIONS`-shaped input).
5. `applyGithubRepoAllowlistToTools` is identity when policy disabled.
6. `applyGithubRepoAllowlistToTools` skips non-`GITHUB_` tools entirely.
7. **Allow case**: an allowed repo call passes through to the
   original `execute`, which is called exactly once with unchanged
   input.
8. **Block case (load-bearing): the original `execute` is NEVER
   called for a non-allowed repo.** Asserted with a stub
   `execute = mock.fn()` and `assert.equal(executeStub.mock.callCount(), 0)`.
9. **Refusal shape**: the value returned by the wrapped `execute`
   matches the documented shape (`{ ok: false, error:
   'repo_not_in_allowlist', blockedRepo, allowedRepos, message }`).
10. **Case-insensitive match**: an allowlist of `['acme/web']` allows
    a call with `{ owner: 'ACME', repo: 'Web' }`.
11. **Fork target rule**: a `GITHUB_FORK_REPOSITORY` call must have
    BOTH source and target on the list to pass.
12. **Validation regex** in `normalizeGithubRepoAllowlist` accepts
    canonical names, rejects shell metacharacters, rejects
    `owner/`, rejects `/name`, lowercases input, dedupes,
    sorts, enforces max length.

**New: `convex/projects.test.ts` (or extend existing if added later)**

Note: Convex mutation handlers are not currently covered by
co-located tests in this branch. Skipping a unit test for the
mutation itself; the HTTP layer's integration test in `src/lib/`
exercises the validation regex via the shared util (see §10), which
is the actual security-load-bearing code.

### Integration (`*.test.ts` co-located in `src/lib/`)

**New: `src/lib/github-repo-allowlist-normalize.test.ts`**

The shared `normalizeGithubRepoAllowlist` util (used by both Convex
and HTTP) is the security-critical surface. Tested independently:

1. Trim + lowercase + dedupe + sort.
2. Rejects malformed entries (regex misses).
3. Truncates at MAX entries (100).
4. Empty input yields empty array, never throws.

### E2E (manual; documented in spec's Verification section)

Out of scope for Phase 3 task list, but called out for QA tracking:

1. Two projects sharing a GitHub connection, each with a different
   allowlist; agent in project A cannot read or write repos owned by
   project B (Success Criterion 4).
2. Clearing the allowlist restores unrestricted access without page
   reload (Story 6).
3. Network panel inspection during a blocked call shows zero
   outbound GitHub or Composio requests for that tool call
   (Success Criterion 1).

### Zero-egress proof (test #8 details)

The unit test for the block case stubs `execute` and asserts
`executeStub.mock.callCount() === 0`. Because the *only* network path
in Composio's tool implementations runs inside that `execute`,
non-invocation is a complete proof of zero egress at the unit-test
boundary. No HTTP-level interception or fixtures required.

---

## 10. File structure / change list

Ordered for Phase 3. Each entry: action — path — purpose.

### Core model + enforcement (the security-critical core)

1. **MODIFY** `convex/schema.ts`
   - Add `githubRepoAllowlist: v.optional(v.array(v.string()))` to the
     `projects` table.
2. **CREATE** `convex/lib/github-repo-allowlist-normalize.ts`
   - Pure-JS `normalizeGithubRepoAllowlist(repos: string[]): string[]`
     and the regex constant. Imported by both Convex
     mutation and the HTTP route handler.
3. **MODIFY** `convex/projects.ts`
   - Add `setGithubRepoAllowlist` mutation using the shared
     normalizer.
4. **CREATE** `src/lib/tools/github-repo-allowlist.ts`
   - Exports:
     - `GithubRepoPolicy` type and `buildGithubRepoPolicy(list)`.
     - `applyGithubRepoAllowlistToTools(toolSet, policy)`.
     - `extractRepoFromComposioGithubArgs(name, input)`.
     - `isGithubComposioTool(name)`.
     - `buildRepoBlockedToolResult(args)`.
5. **CREATE** `src/lib/tools/github-repo-allowlist.test.ts`
   - All unit cases in §9.
6. **CREATE** `src/lib/github-repo-allowlist-normalize.test.ts`
   - Cases in §9.

### HTTP and AI route wiring

7. **MODIFY** `src/app/api/app/projects/route.ts`
   - Extend PATCH body type with `githubRepoAllowlist?: string[]`.
   - Call new `projects:setGithubRepoAllowlist` mutation when
     provided. Validate with the shared normalizer (defense in
     depth) and 400 with a readable message on regex failure.
8. **CREATE** `src/app/api/app/integrations/github/repositories/route.ts`
   - GET-only. Auth via `resolveAuthenticatedAppUser`. Calls
     Composio `LIST_REPOSITORIES`. Maps response shape, lowercases
     `fullName`, returns `{ items, nextCursor, error? }`.
9. **CREATE** `src/lib/composio-sdk-loader.ts` (small extraction)
   - Move the duplicated dynamic-import-with-fallback pattern from
     `src/app/api/app/integrations/route.ts:21–36` and
     `src/lib/composio-tools.ts:91–129` into a single function used
     by all three call sites (DRY win that the new route would
     otherwise re-duplicate). **If this extraction is deemed scope
     creep by the orchestrator, fall back to a small inline duplicate
     in the new route handler.** Flagged in §11.
10. **MODIFY** `src/app/api/app/conversations/act/route.ts`
    - In the project fetch task (lines 843–855), also pull
      `githubRepoAllowlist`.
    - Build `githubRepoPolicy` once per turn.
    - Insert `applyGithubRepoAllowlistToTools(...)` in the
      `composioTools` assembly (after line 1067).
    - Add `githubRepoScopeNote` to the agent `instructions` string
      (around line 1190).

### Typed client + contracts

11. **MODIFY** `packages/overlay-api-client/src/index.ts`
    - Extend `UpdateProjectRequest` to include
      `githubRepoAllowlist?: string[]`.
    - Add `integrations.github.listRepositories` method and its
      `GithubRepositoryListResponse` type.
12. **MODIFY** `packages/overlay-app-core/src/projects.ts`
    - Extend `ProjectHubTab` union to add `'settings'`.
    - Add `GithubRepositoryOption`,
      `GithubRepoAllowlistDraftState` types.
    - Add presentation-helpers: filter+sort, manual-entry
      validation (calls into the shared normalizer regex).

### UI

13. **CREATE** `packages/overlay-modules-react/src/github-repo-picker.tsx`
    - `GithubRepoAllowlistPicker` presentational component.
14. **CREATE** `packages/overlay-modules-react/src/projects-settings.tsx`
    - `ProjectSettingsTabContent` — wraps the picker, accepts data +
      callbacks.
15. **MODIFY** `packages/overlay-modules-react/src/projects.tsx`
    - Extend `ProjectHubTabsProps` with the new `settings` tab
      props.
    - Add a `Settings` tab button.
    - Render `<ProjectSettingsTabContent />` when `activeTab ===
      'settings'`.
16. **MODIFY** `src/components/app/ProjectsView.tsx`
    - Add state for repo list (`items`, `loading`, `error`,
      `manualEntry`, `draftAllowlist`).
    - Fetch on entering the Settings tab when GitHub is connected.
    - Wire save via `overlayAppClient.projects.update()` with
      `githubRepoAllowlist`.
    - Apply server-normalized response back to local state.
    - Hide the tab itself when GitHub is not connected (see §11
      open question for the future toolkit-toggle interaction).

### Tests for the new modules (already listed but enumerated for tasks)

- (covered by items 5 and 6 above)

### Counts

- **Created:** 7 files (4 source + 3 tests).
- **Modified:** 7 files.
- **Total:** 14 file changes.

---

## 11. Risks / open questions for the orchestrator

1. **Settings tab vs. embedded section.** §6 deviates from the spec's
   wording ("Settings tab") only insofar as we are *creating* the tab
   that the spec assumes exists. If the orchestrator wants option B
   (embed under Instructions), the file changes in §10 items 12, 14,
   15 simplify. Flag if you want B.

2. **No existing toolkit-level toggle on this branch.** The spec
   ("hide picker when the GitHub toolkit is disabled for the
   project") presupposes a per-project GitHub toggle that does not
   exist on `fea6917`. v1 reduces to "hide when the user has no
   Composio GitHub connection". When `enabledIntegrationSlugs`
   eventually lands, the visibility rule in
   `ProjectsView.tsx` should be ANDed against
   `project.enabledIntegrationSlugs?.includes('github') !== false`.
   That is a one-line follow-up, not a v1 blocker.

3. **Composio SDK loader extraction (item 9).** The dynamic-import
   fallback pattern is duplicated across 3 call sites today. A clean
   extraction is the right call but technically expands the diff
   beyond strict feature scope. If the orchestrator prefers minimal
   diff, the new repo-list route can inline a fourth copy and we
   defer the refactor.

4. **Composio `LIST_REPOSITORIES` exact response shape.** I have not
   exercised the live call from this code path. The route handler
   in §5 codes against the documented shape (paged list of repo
   records with at least a full-name field). If the live response is
   richer/poorer, the route maps it down to our small DTO at the
   boundary so the rest of the system is unaffected.

5. **Allowlist persistence across disconnect (clarify Q6 option A).**
   The chosen behavior is "persist". The schema change in §2 makes
   this implicit — we never clear the field on disconnect. No
   additional code is required. Calling out so the orchestrator can
   confirm this is the intended interpretation.

6. **Cache invalidation for the per-user Composio tool cache.** The
   10-minute cache in `composio-tools.ts:142` is keyed by `userId`
   and stores the raw, unscoped tool set. Per-turn scoping is applied
   on top, so the cache stays correct for cross-project use. No cache
   bust needed when the allowlist changes; the next turn picks up the
   new policy.

No other blockers. Phase 3 task breakdown can proceed.
