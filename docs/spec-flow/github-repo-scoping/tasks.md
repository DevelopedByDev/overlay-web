# Tasks: GitHub Repository Scoping for Projects

Phase 3 task breakdown anchored to `plan.md` §10. Each task is one TDD cycle
(red → green → refactor). Dependencies are declared honestly so Phase 5
auto-pick can choose parallelism. Tests precede the implementation they cover.

Order conventions:
- Tasks within an H2 layer may be parallelizable iff their `Depends on:` sets
  match exactly.
- A test task is always the dependency of the implementation task it guards.
- All paths are repo-relative to the working tree root.

---

## Data model

### Task 1 — Add `githubRepoAllowlist` to projects schema

**Files:** convex/schema.ts
**Depends on:** none
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Manual type-check / schema diff verification — Convex schemas
are not unit-tested in this tree. The dependent normalizer test (Task 3)
indirectly proves the field is consumed correctly; this task is the smallest
red-green possible (schema field present → downstream type compiles).
**Done when:**
- `projects` table includes `githubRepoAllowlist: v.optional(v.array(v.string()))`.
- No other field changes.
- `npx convex codegen` (run by orchestrator later) would emit the new type
  without conflict.

---

## Normalizer (shared validation, security-critical)

### Task 2 — Write failing tests for `normalizeGithubRepoAllowlist`

**Files:** src/lib/github-repo-allowlist-normalize.test.ts
**Depends on:** none
**Estimated size:** M (30–100)
**TDD cycle:** Failing test: importing `normalizeGithubRepoAllowlist` from
`convex/lib/github-repo-allowlist-normalize.ts` throws `MODULE_NOT_FOUND`.
**Done when:**
- Test file uses `node:test` + `node:assert/strict` and dynamic
  `import(new URL(...).href)` pattern (matches
  `src/lib/tools/exposure-policy.test.ts`).
- Cases per plan §9:
  1. trim + lowercase + dedupe + sort happy path,
  2. rejects malformed entries (regex misses: `owner/`, `/name`,
     shell metacharacters, empty string),
  3. truncates at MAX entries (100) — input of 150 yields exactly 100,
  4. empty input yields empty array without throwing,
  5. canonical valid forms accepted (e.g. `acme/web`, `me-co/awesome.tool_v2`).
- Tests currently fail with import error.

### Task 3 — Implement `normalizeGithubRepoAllowlist`

**Files:** convex/lib/github-repo-allowlist-normalize.ts
**Depends on:** Task 2
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Make Task 2 tests pass. Pure-JS module exporting the regex
constant and `normalizeGithubRepoAllowlist(repos: string[]): string[]`.
**Done when:**
- Exported regex `/^[a-z0-9][a-z0-9-]*\/[a-z0-9._-]+$/` is a named export.
- `normalizeGithubRepoAllowlist` trims, lowercases, regex-validates, dedupes,
  sorts, and slices to 100 entries.
- Invalid entries throw a structured error naming the offending value (no
  silent drops — required for HTTP 400 surfacing).
- All Task 2 tests pass.
- File has no Convex or Node-only imports (must be safe to import from both
  Convex runtime and Next.js route).

---

## Convex mutation

### Task 4 — Add `setGithubRepoAllowlist` mutation

**Files:** convex/projects.ts
**Depends on:** Task 1, Task 3
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Convex mutations are not unit-tested in this branch (plan §9
calls this out). Verification is through the HTTP route integration test
(Task 11) which exercises this path. Smallest cycle: mutation present →
downstream PATCH wiring compiles and forwards through.
**Done when:**
- New mutation `setGithubRepoAllowlist` exported, mirrors `update` auth style.
- Calls `authorizeUserAccess` and verifies `project.userId === userId`.
- Calls `normalizeGithubRepoAllowlist`; stores `undefined` if result is empty
  array (Story 3 backward-compat shape).
- Patches `updatedAt: Date.now()`.
- Returns the normalized list so the client can sync immediately.

---

## Enforcement layer (tool-call interception)

### Task 5 — Failing test for `extractRepoFromComposioGithubArgs`

**Files:** src/lib/tools/github-repo-allowlist.test.ts (initial cases only)
**Depends on:** none
**Estimated size:** M (30–100)
**TDD cycle:** Failing test: importing
`extractRepoFromComposioGithubArgs` throws `MODULE_NOT_FOUND`.
**Done when:**
- Test file scaffolded with `node:test` + `assert/strict`.
- Cases (plan §9 cases 1–4):
  1. `{ full_name: 'octocat/Hello' }` → `{owner:'octocat', name:'hello'}`,
  2. `{ owner, repo }` form resolves,
  3. `{ owner, name }` form resolves,
  4. no-repo-arg shape returns `null`.
- Currently fails with import error.

### Task 6 — Implement `extractRepoFromComposioGithubArgs` and `isGithubComposioTool`

**Files:** src/lib/tools/github-repo-allowlist.ts
**Depends on:** Task 5
**Estimated size:** M (30–100)
**TDD cycle:** Make Task 5 tests pass. Exports the arg parser + the
name-prefix predicate. No tool-wrap logic yet.
**Done when:**
- `isGithubComposioTool(name)` returns true iff name starts with `GITHUB_`.
- `extractRepoFromComposioGithubArgs(name, input)` follows precedence order
  from plan §4 (full_name → repo_full_name → owner+repo → owner+name →
  repository → fork target rule placeholder returning null).
- All Task 5 cases green.
- Lowercase+trim normalization on returned values.

### Task 7 — Load-bearing security test: `originalExecute` is NEVER called for non-allowed repo

**Files:** src/lib/tools/github-repo-allowlist.test.ts (extends Task 5 file)
**Depends on:** Task 6
**Estimated size:** M (30–100)
**TDD cycle:** Failing test: importing `applyGithubRepoAllowlistToTools` and
`buildGithubRepoPolicy` throws `MODULE_NOT_FOUND`. Once imports resolve, the
block-case assertion
`assert.equal(executeStub.mock.callCount(), 0)` fails until enforcement is
wired correctly.
**Done when:**
- Test case titled exactly **"zero invocation of originalExecute when a
  non-allowed repo is targeted"** exists and asserts
  `executeStub.mock.callCount() === 0` after the wrapped `execute` resolves.
- Additional cases per plan §9 (5–11):
  - identity when policy disabled,
  - skips non-`GITHUB_` tools entirely,
  - allow case: `originalExecute` called exactly once with unchanged input,
  - refusal payload shape matches documented schema,
  - case-insensitive match (`ACME/Web` allowed by `acme/web` entry),
  - fork target rule: both source AND target must be on allowlist.
- All currently fail with import error or assertion failure.

### Task 8 — Implement `applyGithubRepoAllowlistToTools` and `buildGithubRepoPolicy`

**Files:** src/lib/tools/github-repo-allowlist.ts
**Depends on:** Task 7
**Estimated size:** L (> 100)
**TDD cycle:** Make Task 7 tests pass. Adds the wrap function, policy
builder, refusal payload builder, and the fork-target precedence rule (item
6 from plan §4 parser).
**Done when:**
- `buildGithubRepoPolicy(list)` returns `{ enabled, list, allows(target) }`
  with case-insensitive set lookup.
- `applyGithubRepoAllowlistToTools(toolSet, policy)` is identity when
  `policy.enabled === false`.
- For each `GITHUB_*` tool with a function `execute`, wraps it to:
  - extract target via `extractRepoFromComposioGithubArgs`,
  - if target present AND not allowed → return
    `buildRepoBlockedToolResult({...})` WITHOUT calling original,
  - else → delegate to original `execute` unchanged.
- For `GITHUB_FORK_*` / `GITHUB_*_TRANSFER_*`, require both source and target
  repos to be in allowlist (more conservative).
- Never throws on a blocked call (plan §8 invariant).
- All Task 7 cases green, including the load-bearing zero-invocation test.

---

## HTTP routes

### Task 9 — Extend `UpdateProjectRequest` typed client field

**Files:** packages/overlay-api-client/src/index.ts
**Depends on:** none
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Smallest cycle: type-only addition; downstream
`ProjectsView.tsx` (Task 18) imports and passes the new field, failing to
compile until this type exists.
**Done when:**
- `UpdateProjectRequest` interface includes
  `githubRepoAllowlist?: string[]`.
- No behavior change to `projects.update` call site.

### Task 10 — Failing integration test for PATCH `/api/app/projects` allowlist field

**Files:** src/lib/github-repo-allowlist-normalize.test.ts (extends Task 2 file)
**Depends on:** Task 3
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Tests the shared normalizer is wired into the validation
contract that the PATCH route will enforce. Failing test asserts a known
malformed entry (`owner/`) is rejected with an error message naming the
entry — the route handler (Task 11) must surface this verbatim.
**Done when:**
- New case added: malformed entry rejected with error message containing the
  exact offending string.
- Currently passes (normalizer already does this) but locks the contract for
  Task 11.

### Task 11 — Extend PATCH `/api/app/projects` route with allowlist persistence

**Files:** src/app/api/app/projects/route.ts
**Depends on:** Task 4, Task 9, Task 10
**Estimated size:** M (30–100)
**TDD cycle:** Verification: existing PATCH integration paths still pass;
new field forwarded to `setGithubRepoAllowlist` mutation. Failing
"red" is route compile error — `githubRepoAllowlist` parsed but no mutation
exists until Task 4.
**Done when:**
- PATCH body type accepts optional `githubRepoAllowlist: string[]`.
- When present, calls `projects:setGithubRepoAllowlist` and returns the
  normalized result inside the existing `{ success: true, project }` shape.
- Defense in depth: also runs `normalizeGithubRepoAllowlist` locally before
  dispatching; returns HTTP 400 with the regex-fail message on malformed
  entries (no Convex round-trip on invalid input).
- Unauthorized path unchanged (still HTTP 401).
- Reuses `resolveAuthenticatedAppUser`.

### Task 12 — Add `integrations.github.listRepositories` typed client method

**Files:** packages/overlay-api-client/src/index.ts
**Depends on:** Task 9
**Estimated size:** S (≤ 30 LOC)
**TDD cycle:** Smallest cycle: type + method exist; downstream UI fetch in
Task 18 fails to compile until present.
**Done when:**
- Exported `GithubRepositoryListResponse` type:
  `{ items: Array<{ fullName: string; private?: boolean; archived?: boolean }>, nextCursor: string | null, error?: 'github_not_connected' | 'fetch_failed' | 'rate_limited' }`.
- `integrations.github.listRepositories(query?, init?)` method follows the
  existing `integrations` block conventions (line ~454–482).
- No additional fetch behavior changes.

### Task 13 — Create GET `/api/app/integrations/github/repositories` route

**Files:** src/app/api/app/integrations/github/repositories/route.ts
**Depends on:** Task 12
**Estimated size:** M (30–100)
**TDD cycle:** Verification: route returns the documented DTO shape.
Failing "red" is route file missing → typed client method returns 404 in
local smoke. (Open-question #3 from plan §11 is folded here: the Composio
SDK loader extraction is **skipped** for v1 — we inline a fourth copy of
the dynamic-import-with-fallback in this route, keeping the diff scoped to
the feature.)
**Done when:**
- GET handler authenticates via `resolveAuthenticatedAppUser`.
- Calls Composio `LIST_REPOSITORIES` (inline SDK loader copy is acceptable).
- Returns `{ items, nextCursor, error? }` exactly matching the typed
  response from Task 12.
- `fullName` is lowercased before returning.
- Pagination cursor is passed through opaquely.
- Defaults: limit 100, max 200.
- Failure mapping: Composio exception → HTTP 200 `{ items: [], nextCursor:
  null, error: 'fetch_failed' }`; no Composio account → HTTP 200
  `{ error: 'github_not_connected' }`; rate limit → HTTP 200
  `{ error: 'rate_limited' }`.

---

## act/route.ts wiring (enforcement + agent context)

### Task 14 — Wire allowlist policy + agent context note into act route

**Files:** src/app/api/app/conversations/act/route.ts
**Depends on:** Task 1, Task 8
**Estimated size:** M (30–100)
**TDD cycle:** Verification through the existing conversation-act flow plus
the Task 7 enforcement tests. Failing "red" is type error — the new policy
builder is referenced before being imported.
**Done when:**
- Project fetch (around lines 843–855) also reads `githubRepoAllowlist`.
- `const githubRepoPolicy = buildGithubRepoPolicy(project?.githubRepoAllowlist)`
  is built once per turn.
- `applyGithubRepoAllowlistToTools(...)` is inserted into the `composioTools`
  assembly **after** the existing
  `filterComposioToolSetForPaidOnlyFeatures` call (line ~1064–1067).
- When `policy.enabled === true`, `githubRepoScopeNote` is appended to the
  `ToolLoopAgent` `instructions` string near `toolAuthorizationNote`
  (line ~1190) using the exact wording in plan §7.
- When `policy.enabled === false`, **no note is injected** (Story 3 stays
  identical to today).
- One `info`-level log per blocked tool call (debuggability per plan §8
  table).

---

## Project core types

### Task 15 — Extend `overlay-app-core/projects.ts` types and presentation helpers

**Files:** packages/overlay-app-core/src/projects.ts
**Depends on:** Task 3
**Estimated size:** M (30–100)
**TDD cycle:** Smallest cycle: type+helper additions; downstream UI imports
(Tasks 16, 17, 18) fail to compile until these exist. Manual-entry
validation helper is the one piece of behavior worth unit-testing —
co-locate one assertion to lock the wrap around the shared regex.
**Done when:**
- `ProjectSettingsSectionId` exported as string-literal union (v1: just
  `'github-repositories'`).
- `GithubRepositoryOption`, `GithubRepoAllowlistDraftState`,
  `ProjectSettingsDrawerState` types exported.
- Presentation helpers exported: filter+sort (selected first), manual-entry
  validator that wraps the shared regex from Task 3.
- **No** change to `ProjectHubTab` union (drawer is not a tab — plan §6).

---

## Drawer shell and section registry

### Task 16 — Create `ProjectSettingsDrawer` presentational shell

**Files:** packages/overlay-modules-react/src/project-settings-drawer.tsx
**Depends on:** Task 15
**Estimated size:** M (30–100)
**TDD cycle:** Smallest cycle: presentational shell renders; downstream
`ProjectsView.tsx` (Task 18) fails to compile until the prop contract exists.
**Done when:**
- Exports `ProjectSettingsDrawer` with props `{ open, onOpenChange, sections,
  activeSectionId, onActiveSectionChange, layoutMode: 'push' | 'overlay',
  width? }`.
- Renders left rail (vertical section buttons) + scrollable content panel +
  close button + header (project name read-only).
- In `layoutMode='overlay'`: handles click-outside-to-close and
  Escape-to-close.
- In `layoutMode='push'`: no overlay behaviors; pure layout.
- No internal state besides what's required for keyboard handling.

### Task 17 — Create section registry + `GithubRepoAllowlistPicker`

**Files:** packages/overlay-modules-react/src/project-settings-sections.tsx, packages/overlay-modules-react/src/github-repo-picker.tsx
**Depends on:** Task 15
**Estimated size:** L (> 100)
**TDD cycle:** Smallest cycle: registry returns a single section whose
`render` returns the picker; manual smoke test in Task 18 wiring confirms
end-to-end rendering. (Two files but trivially one TDD unit — the section
factory exists *to* render the picker; splitting would force a stub picker
in between.)
**Done when:**
- `project-settings-sections.tsx` exports `ProjectSettingsSection` type and
  `createProjectSettingsSections(ctx)` factory returning a 1-entry array
  whose `render` returns `<GithubRepoAllowlistPicker {...} />`.
- `github-repo-picker.tsx` exports `GithubRepoAllowlistPicker`
  presentational component with props `{ value, options, loading, error,
  onChange, onAddManual, onRetryLoad, manualEntry }`.
- Picker renders:
  - search input,
  - checkbox list (selected repos pinned to top),
  - manual-entry input + Add button (always visible),
  - skeleton + spinner on `loading`,
  - error banner with Retry on `error === 'fetch_failed'`,
  - rate-limit copy on `error === 'rate_limited'`,
  - "Connect GitHub" empty state on `error === 'github_not_connected'`,
  - "All repositories are accessible" hint on empty value with toolkit on.
- Manual entry validates against the helper from Task 15 before calling
  `onAddManual`.

---

## Project hub wiring

### Task 18 — Wire drawer state, gear button, and data flow into `ProjectsView`

**Files:** packages/overlay-modules-react/src/projects.tsx, src/components/app/ProjectsView.tsx
**Depends on:** Task 11, Task 13, Task 14, Task 16, Task 17
**Estimated size:** L (> 100)
**TDD cycle:** Final integration. Smallest cycle: gear button visible →
clicking it opens drawer → GitHub section renders → repos load → save round-
trips. Verification is end-to-end (browser smoke + the existing component
test conventions). Failing "red" is the gear button rendering without a
working open handler.
**Done when:**
- `projects.tsx` `ProjectHubHeader` `actions` slot accepts a `settingsDrawer`
  toggle handle and renders the gear-icon button only when the parent
  supplies it. Presentational — no internal state.
- `ProjectsView.tsx` owns:
  - `settingsDrawerOpen: boolean` (persisted via `localStorage` key
    `overlay.project-settings-drawer.open`),
  - `activeSettingsSectionId: ProjectSettingsSectionId` (persisted),
  - draft allowlist state, repo list `items`, `loading`, `error`,
    `manualEntry`.
- Push vs overlay decided by `window.matchMedia('(max-width: 768px)')`.
- On drawer open AND GitHub repos section active AND user has Composio
  GitHub connection (from existing `integrations.get()` load): fetch via
  `overlayAppClient.integrations.github.listRepositories()` and update
  state.
- Save button calls `overlayAppClient.projects.update({ ...,
  githubRepoAllowlist })`; the server-normalized response replaces local
  state (Success Criterion 7).
- Clearing the list (saving `[]`) is supported and restores permissive
  default on next chat turn (Story 6).
- Manual-entry path works when `error === 'fetch_failed'`.
- No autosave; explicit Save button mirrors instructions flow.

---

## Summary of dependency shape

- Tasks 1, 2, 5, 9 are independent leaves (Phase 5 parallel kickoff).
- Tasks 3, 6, 12, 15 form the first dependent layer.
- Tasks 4, 7, 10 sit one level deeper; Tasks 8, 11, 13 close out the backend
  layer.
- Tasks 14, 16, 17 are parallelizable once their immediate deps land.
- Task 18 is the final sequential gather point — it pulls every prior layer
  together for end-to-end verification.
