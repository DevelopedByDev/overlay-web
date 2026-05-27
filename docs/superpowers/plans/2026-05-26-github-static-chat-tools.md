# GitHub Static Chat Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Composio v3 tool-router session in the chat path with a static `composio.tools.get(...)` call scoped to GitHub, so individual `GITHUB_*` tools land in the model's toolset and the existing per-project repo allowlist (`applyGithubRepoAllowlistToTools`) actually fires.

**Architecture:** Drop `composio.create(entityId, ...)` + `session.tools()` from `src/server/tools/composio-tools.ts`. Replace with `composio.tools.get(entityId, { toolkits: ['github'] })` — the static-tools SDK surface that returns Vercel-AI-SDK-compatible tool callables. Bind GitHub `connected_account_id` ahead of time if VercelProvider's wrap doesn't (verified per smoke in Task 0). Strip `withConsistentComposioSession`, `resolveComposioSessionIdFactory`, and `REMOVED_COMPOSIO_TOOLS` — all tool-router artifacts that don't apply. Introduce a dependency-injection seam in `buildBrowserUnifiedTools` (accept optional `composio` instance) so tests don't need a back-channel.

**Tech Stack:** Next.js (server route handlers), Composio SDK `@composio/core@0.6.7` + `@composio/vercel`, Vercel AI SDK `ToolSet`, `node:test` (test runner), TypeScript strict mode.

**Spec:** `/Users/dusseau/.claude/plans/system-instruction-you-are-working-kind-nygaard.md` § "Update 6".

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/server/tools/composio-tools.ts` | Modify | Add DI seam. Swap session API for static `tools.get`. Delete `withConsistentComposioSession`, `resolveComposioSessionIdFactory`, `REMOVED_COMPOSIO_TOOLS`. Update diagnostic log. Add dev-only cache flush. |
| `src/server/tools/tools/github-repo-allowlist.ts` | No change | Continues to wrap `GITHUB_*` tools as designed. Now load-bearing for the first time. |
| `src/server/tools/tools/github-repo-allowlist.test.ts` | Modify | Add tests proving the wrap fires + blocks against a realistic `GITHUB_*` ToolSet shape. |
| `src/server/tools/composio-tools.test.ts` | Create | Unit test using DI seam: `buildBrowserUnifiedTools` returns `GITHUB_*` keys when given a stub `composio` returning a stub toolset. Verifies the shape, not Composio behavior. |
| `scripts/composio-tools-smoke.ts` | Create (temp) | One-shot smoke script verifying `composio.tools.get` returns a usable Vercel-AI-SDK ToolSet against a real connected entity. Used in Task 0; deleted in Task 7. |

---

## Task 0: Pre-flight smoke + SDK signature lookup

**Files:**
- Create (temporary): `scripts/composio-tools-smoke.ts`

Purpose: validate two spec assumptions and resolve one SDK signature ambiguity BEFORE writing implementation code.

- [x] **Step 1: Resolve the `tools.get` SDK signature (no code, just record)**

Verbatim from `node_modules/@composio/core/dist/composio-CbZbGwhD.d.mts:234`:

```ts
get<T extends TProvider>(userId: string, filters: ToolListParams, options?: ProviderOptions<TProvider>): Promise<ReturnType<T['wrapTools']>>;
```

`ToolListParams` is a discriminated union (from `node_modules/@composio/core/dist/tool.types-bencsexi.d.mts:22872-22920`). Verbatim:

```ts
type BaseParams = {
  limit?: number;
  search?: string;
  scopes?: string[];
  tags?: string[];
};
type ToolsOnlyParams = {
  tools: string[];
  toolkits?: never;
  scopes?: never;
  search?: never;
  tags?: never;
};
type ToolkitsOnlyParams = {
  toolkits: string[];
  tools?: never;
  scopes?: never;
  important?: boolean;
} & Pick<BaseParams, 'limit' | 'search' | 'tags'>;
type ToolkitScopeOnlyParams = {
  toolkits: [string];
  tools?: never;
  scopes: string[];
  important?: boolean;
} & Pick<BaseParams, 'limit' | 'search' | 'tags'>;
type TagsOnlyParams = {
  toolkits?: string[];
  tags: string[];
  tools?: never;
  search?: never;
} & Pick<BaseParams, 'limit'>;
type SearchOnlyParams = {
  search: string;
  tools?: never;
  toolkits?: never;
  scopes?: never;
  limit?: never;
  tags?: never;
};
type AuthConfigIdsOnlyParams = {
  authConfigIds: string[];
  tools?: never;
  toolkits?: never;
} & Pick<BaseParams, 'limit' | 'search' | 'tags'>;
/**
 * ToolListParams is the parameters for the list of tools.
 * You must provide either tools or toolkits, but not both.
 */
type ToolListParams = ToolsOnlyParams | ToolkitsOnlyParams | ToolkitScopeOnlyParams | SearchOnlyParams | TagsOnlyParams | AuthConfigIdsOnlyParams;
```

**Connection scoping result:** `ToolListParams` has **NO `connectedAccountId` field and NO `connectedAccountIds` field**. The only connection-adjacent field is `authConfigIds` (a different concept — selects auth configs, not individual connected accounts). The third arg `options?: ProviderOptions<TProvider>` resolves (per `tool.types-bencsexi.d.mts:22228, 22297`) to `AgenticToolOptions = ToolOptions & ExecuteToolModifiers`, where `ExecuteToolModifiers` is only `{ beforeExecute?, afterExecute? }` hooks (lines 22060-22071) — no `connectedAccountId` field there either.

**Implication for YELLOW branch:** `connectedAccountId` binding cannot be passed as a top-level filter on `tools.get(...)`. If VercelProvider's wrapped `execute` does not auto-resolve the account, the binding must go through a `beforeExecute` modifier that injects `connectedAccountId` per call (it IS a field on `ExecuteToolFnOptions` at `tool.types-bencsexi.d.mts:20794`).

- [x] **Step 2: Create the smoke script**

```ts
// scripts/composio-tools-smoke.ts
/**
 * One-shot smoke. Run via: pnpm tsx scripts/composio-tools-smoke.ts
 *
 * Requires env:
 *   COMPOSIO_API_KEY                — your Composio dev key
 *   COMPOSIO_SMOKE_ENTITY_ID        — entity with active github connection
 *
 * Validates:
 *   1. composio.tools.get returns Vercel-AI-SDK-compatible tools with execute().
 *   2. One of those tools can execute against a public github repo.
 *      Failure mode of interest: ActionExecute_ConnectedAccountEntityIdRequired.
 */
import { Composio } from '@composio/core'
import { VercelProvider } from '@composio/vercel'

const apiKey = process.env.COMPOSIO_API_KEY
const entityId = process.env.COMPOSIO_SMOKE_ENTITY_ID
if (!apiKey || !entityId) {
  console.error('Need COMPOSIO_API_KEY and COMPOSIO_SMOKE_ENTITY_ID env vars')
  process.exit(1)
}

const composio = new Composio({ apiKey, provider: new VercelProvider() })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolset = (await composio.tools.get(entityId, { toolkits: ['github'] })) as any
const keys = Object.keys(toolset).sort()
console.log('Returned tool count:', keys.length)
console.log('First 20 keys:', keys.slice(0, 20))

const repoTool =
  toolset['GITHUB_GET_REPOSITORY'] ?? toolset['GITHUB_GET_REPO'] ?? toolset['GITHUB_GET_A_REPOSITORY']
if (!repoTool?.execute) {
  console.error('No GITHUB_GET_* repo tool with execute() found in toolset')
  process.exit(2)
}

try {
  const result = await repoTool.execute({ owner: 'composiohq', repo: 'composio' })
  console.log('Tool execute result (first 400 chars):', JSON.stringify(result).slice(0, 400))
  process.exit(0)
} catch (err) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any
  console.error('Tool execute threw.')
  console.error('  message:', anyErr?.message ?? String(err))
  console.error('  cause.status:', anyErr?.cause?.status)
  console.error('  cause.error:', JSON.stringify(anyErr?.cause?.error).slice(0, 400))
  process.exit(3)
}
```

- [x] **Step 3: Pull the entity id from Convex**

Resolved via Convex MCP `runOneoffQuery` against `unspecified` deployment (`dev:first-trout-515`):
- Project `mh715nq1eaep590qkzhn4drm3x871s9a` → `userId: user_01K75Z8N3FK5TD9CD116HHP87A` (name: "Reliance Financial")
- Reconstructed entity ID: `overlay_project_user_01K75Z8N3FK5TD9CD116HHP87A_mh715nq1eaep590qkzhn4drm3x871s9a`
- Last-8-char suffix `3x871s9a` matches the spec's expected dev-server log suffix.


The github-connected project we've been debugging has Convex `projectId: mh715nq1eaep590qkzhn4drm3x871s9a`. The entity id is `overlay_project_<userId>_mh715nq1eaep590qkzhn4drm3x871s9a` — get the `<userId>` part by running:

```bash
grep -E "(COMPOSIO_API_KEY|NEXT_PUBLIC_CONVEX_URL)" .env.local
```

then either (a) look in the Convex dashboard for the user record under this project, or (b) re-trigger any GitHub-using endpoint and grep the dev-server log for `[Integrations] GET listed accounts for <suffix>:` — the suffix is the last 8 chars of the entity id, telling you what to reconstruct.

- [x] **Step 4: Run the smoke**

```bash
COMPOSIO_API_KEY=<from .env.local> \
COMPOSIO_SMOKE_ENTITY_ID=<reconstructed> \
  pnpm tsx scripts/composio-tools-smoke.ts
```

Capture the full output. Three outcomes; each routes the rest of this plan:

| Outcome | Branch | Action |
|---|---|---|
| Tool keys printed AND execute returned repo data | **Green** | VercelProvider auto-resolves `connectedAccountId`. Task 3 does NOT need a connectedAccount lookup. |
| Tool keys printed BUT execute threw with `cause.error.slug === "ActionExecute_ConnectedAccountEntityIdRequired"` | **Yellow** | VercelProvider does NOT auto-bind. Task 3 must include a `composio.connectedAccounts.list({ userIds: [entityId], toolkitSlugs: ['github'] })` lookup and bind via the exact SDK field recorded in Step 1 (`connectedAccountIds`, `connectedAccountId`, or per-call modifier). Task 3 has a designated insertion point for this code. |
| Zero `GITHUB_*` keys returned | **Red** | `tools.get` isn't working as expected. STOP. Re-verify Step 1's SDK signature; either we read the wrong type, or the SDK has additional requirements (e.g. needs `connectedAccountIds` to pre-load tools). |

- [x] **Step 5: Record the branch in this plan**

**Smoke result: GREEN. Task 3 does not need a connectedAccountId lookup.**

Evidence (smoke run output, 2026-05-27):
- `composio.tools.get(entityId, { toolkits: ['github'] })` returned 20 `GITHUB_*` keys (alphabetically first 20 — see caveat below).
- A direct-named follow-up call `composio.tools.get(entityId, { tools: ['GITHUB_GET_A_REPOSITORY'] })` returned the tool, and `repoTool.execute({ owner: 'composiohq', repo: 'composio' })` succeeded with real GitHub JSON. Exit code 0.
- VercelProvider's wrap auto-resolved `connectedAccountId` from the entity binding — no `ActionExecute_ConnectedAccountEntityIdRequired` error.

**Caveat to fold into Task 3:** the `{ toolkits: ['github'] }` filter alone returns only 20 tools by default (SDK page-size cap). Real GITHUB_GET_* tools are NOT in the alphabetically-first 20 — they only appeared on the explicit `{ tools: [...] }` call. Task 3 should decide whether to (a) pass an explicit `limit` (and verify the max), (b) enumerate the specific tools the chat path actually needs, or (c) accept the alphabetical cap. Without one of those, the model will not see `GITHUB_GET_A_REPOSITORY` / `GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER` etc. and the original chat regression will look fixed at the toolset-keys log line but still fail at model behavior time.

- [x] **Step 6: Commit the smoke + the recorded result**

```bash
git add scripts/composio-tools-smoke.ts docs/superpowers/plans/2026-05-26-github-static-chat-tools.md
git commit -m "chore(chat-tools): add Composio tools.get smoke + record SDK signature"
```

- [x] **Step 7: Follow-up smoke with `limit: 500` (run after Step 4 surfaced 20-tool default cap)**

Re-ran the smoke with `{ toolkits: ['github'], limit: 500 }`. Results:

- Returned **500 tools** (Composio honors the limit).
- 187 `GITHUB_GET_*` tools, 58 `GITHUB_LIST_*` tools.
- `GITHUB_GET_A_REPOSITORY` executes against `composiohq/composio` and returns real repo JSON.
- VercelProvider auto-binds `connectedAccountId` (no explicit lookup needed in Task 3).

**Critical product finding:** `{ toolkits: ['github'], limit: 500 }` exposes destructive operations (`GITHUB_DELETE_*`, `GITHUB_ADD_REPOSITORY_COLLABORATOR`, `GITHUB_ABORT_REPOSITORY_MIGRATION`, `GITHUB_ADD_EMAIL_ADDRESS_FOR_AUTHENTICATED_USER`, etc.). The existing `applyGithubRepoAllowlistToTools` wrap only enforces *repo-scope* (refuses non-allowlisted repos) — it does NOT distinguish read vs write/admin ops. Exposing 500 tools also means a huge prompt overhead.

**Decision (user-approved):** Phase A of this PR uses a **curated read-only tool list** (~10-15 tools) instead of the open `{ toolkits, limit }` config. Phase B (separate follow-up PR) adds a per-project opt-in flag for full toolkit access.

---

## Phase A vs Phase B scope

### Phase A — this PR

Pass an explicit `tools: [...]` array of READ-only GitHub tools to `composio.tools.get(entityId, { tools: [...] })`. Tight security (no write/admin ops reachable from chat), small prompt (~10-15 tools), matches the original product intent of "chat can answer questions about an allowlisted repo." The allowlist wrap still operates per-repo as the second layer of defense.

### Phase B — follow-up PR (NOT in this plan's execution scope)

Add a per-project `allowGithubWrites: boolean` field (defaults false). When true, the chat loads the broader `{ toolkits: ['github'], limit: 500 }` toolset; when false, the curated read-only list. UI: a single checkbox in the project settings drawer next to the github integration row. Requires Convex schema change, mutation, Convex deploy, route plumbing, and UI work. Track separately. Document Phase B in its own design doc when scheduled.

---

## Task 1: Verify allowlist wrap still passes against a realistic `GITHUB_*` ToolSet (green baseline)

We test the unchanged wrap BEFORE making any change to `composio-tools.ts`, so any later regression points to the swap, not to the wrap.

**Files:**
- Modify: `src/server/tools/tools/github-repo-allowlist.test.ts` (append new tests)

- [x] **Step 1: Write the test**

```ts
test('applyGithubRepoAllowlistToTools wraps GITHUB_* tools with execute callables (post-swap shape)', async () => {
  const { applyGithubRepoAllowlistToTools } = await import(
    new URL('./github-repo-allowlist.ts', import.meta.url).href,
  )

  let composioCalled = false
  const fakeToolSet = {
    GITHUB_GET_REPO: {
      description: 'Get a github repo',
      execute: async (input: { owner: string; repo: string }) => {
        composioCalled = true
        return { ok: true, name: input.repo }
      },
    },
  }

  const wrapped = applyGithubRepoAllowlistToTools(fakeToolSet, {
    enabled: true,
    allowedRepos: ['acme/web'],
  })

  composioCalled = false
  const allowed = await wrapped.GITHUB_GET_REPO.execute(
    { owner: 'acme', repo: 'web' },
    {},
  )
  assert.equal(composioCalled, true, 'composio should be called for allowed repo')
  assert.equal((allowed as { ok: boolean }).ok, true)

  composioCalled = false
  const blocked = await wrapped.GITHUB_GET_REPO.execute(
    { owner: 'evil', repo: 'corp' },
    {},
  )
  assert.equal(composioCalled, false, 'composio must NOT be called for disallowed repo')
  assert.equal((blocked as { ok: boolean }).ok, false)
  assert.match(
    (blocked as { error: string }).error,
    /repo_not_in_allowlist|not.*allowed/i,
  )
})
```

> **Execution note (2026-05-27):** the literal policy `{ enabled: true, allowedRepos: ['acme/web'] }` shown above does not satisfy the real `GithubRepoPolicy` type (`github-repo-allowlist.ts:140-151` — requires `enabled`, `list`, and an `allows()` method). Adapted at implementation time to use `buildGithubRepoPolicy(['acme/web'])`, which is the documented constructor and the convention every other wrap test in the file uses. Test intent (verify allowed-passes-through + disallowed-blocks against a realistic `{ description, execute }` toolset shape) is preserved. See `github-repo-allowlist.test.ts:219-280`.

- [x] **Step 2: Run, verify GREEN before any source changes**

Run: `node --test --import tsx src/server/tools/tools/github-repo-allowlist.test.ts`
Expected: PASS — this is verifying existing behavior. If it FAILS, the wrap's contract diverges from the spec assumption and the whole plan needs revision.

Result (2026-05-27): `# tests 18 # pass 18 # fail 0` — new test landed as #18.

- [x] **Step 3: Commit**

```bash
git add src/server/tools/tools/github-repo-allowlist.test.ts
git commit -m "test(allowlist): green baseline — wrap fires + blocks on realistic GITHUB_* shape"
```

---

## Task 2: Introduce DI seam in `buildBrowserUnifiedTools`

Refactor without behavior change. After this task, the function signature accepts an optional `composio` instance; production path is unchanged (defaults to live SDK), but tests can inject a fake.

**Files:**
- Modify: `src/server/tools/composio-tools.ts`

- [x] **Step 1: Define a narrow `ComposioLike` type at top of file**

```ts
// Minimal surface of the Composio SDK that buildBrowserUnifiedTools uses.
// Letting tests pass a fake without depending on @composio/core types.
type ComposioLike = {
  tools: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(userId: string, filters: { toolkits?: string[] }, options?: any): Promise<ToolSet>
  }
  connectedAccounts?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    list(query: { userIds: string[]; toolkitSlugs?: string[] }): Promise<any>
  }
}
```

- [x] **Step 2: Refactor `buildBrowserUnifiedTools` signature**

```ts
async function buildBrowserUnifiedTools(args: {
  userId: string
  projectId: string
  accessToken?: string
  /** Inject a Composio SDK instance (or fake) for tests. */
  composio?: ComposioLike
}): Promise<ToolSet> {
  let composio: ComposioLike
  if (args.composio) {
    composio = args.composio
  } else {
    const apiKey = await getComposioApiKey(args.accessToken)
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured. Set it in Convex or the server environment.')
    }
    const { Composio, VercelProvider } = await loadComposioModules()
    composio = new Composio({ apiKey, provider: new VercelProvider() }) as ComposioLike
  }

  // ... rest of the function unchanged for this task ...
}
```

- [x] **Step 3: Typecheck + lint**

```bash
pnpm typecheck
pnpm lint src/server/tools/composio-tools.ts
```

Expected: 0 errors. Behavior is identical for production callers (they don't pass `composio`).

- [x] **Step 4: Commit**

```bash
git add src/server/tools/composio-tools.ts
git commit -m "refactor(chat-tools): add DI seam for Composio SDK"
```

> **Execution note (2026-05-27):** Used the briefing's `ComposioLike` shape (includes both `create` and `tools.get`) rather than the plan-text's `tools` + `connectedAccounts` shape. Rationale: Task 2 keeps using `composio.create(...)`, so the type must still cover that call to keep production code compiling; Task 3 swaps to `tools.get`, which is also already on the type. The `connectedAccounts` field was tied to the YELLOW-branch fallback that Task 0 Step 7 retired (GREEN — VercelProvider auto-binds), so it's no longer needed.

---

## Task 3: Swap `composio.create` → `composio.tools.get` (the core change)

**Files:**
- Modify: `src/server/tools/composio-tools.ts` (inside `buildBrowserUnifiedTools`)

- [ ] **Step 1: Write the failing unit test FIRST**

In `src/server/tools/composio-tools.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'

test('buildBrowserUnifiedTools returns GITHUB_* tools using injected Composio stub', async () => {
  const { createBrowserUnifiedTools } = await import(
    new URL('./composio-tools.ts', import.meta.url).href,
  )

  const stubComposio = {
    tools: {
      get: async (_entityId: string, filters: { toolkits?: string[] }) => {
        assert.deepEqual(filters.toolkits, ['github'])
        return {
          GITHUB_GET_REPO: {
            description: 'Get a repo',
            execute: async () => ({ ok: true }),
          },
          GITHUB_LIST_REPOSITORY_CONTENT: {
            description: 'List repo files',
            execute: async () => ({ ok: true, items: [] }),
          },
        }
      },
    },
  }

  const tools = await createBrowserUnifiedTools({
    userId: 'test-user',
    projectId: 'test-project',
    composio: stubComposio,
  })

  const keys = Object.keys(tools)
  const githubKeys = keys.filter((k) => k.startsWith('GITHUB_'))
  assert.ok(
    githubKeys.length >= 2,
    `expected at least 2 GITHUB_* keys, got: ${keys.join(', ')}`,
  )
})
```

- [ ] **Step 2: Run test, verify it fails meaningfully**

Run: `node --test --import tsx src/server/tools/composio-tools.test.ts`
Expected: FAIL because the current implementation still calls `composio.create(...).tools()` (which doesn't exist on the stub). The error should mention `tools()` or `create` being undefined.

(If `createBrowserUnifiedTools` isn't exported, also export it now — the existing `prewarmBrowserUnifiedTools` and `getBrowserUnifiedTools` wrap it but the test goes direct.)

- [ ] **Step 3: Define the curated READ-only tool list**

In `src/server/tools/composio-tools.ts`, near the top of the file (after imports), declare a frozen constant:

```ts
/**
 * Curated read-only GitHub tool slugs surfaced to the chat AI.
 *
 * Selected to cover "ask questions about an allowlisted repo" use cases —
 * NO write/admin/destructive operations. Composio's `{ toolkits: ['github'] }`
 * filter exposes ~500 tools including DELETE/ADD_COLLABORATOR/etc.; this list
 * narrows the surface to the minimum set the chat needs.
 *
 * If user opts in to writes (Phase B follow-up: per-project `allowGithubWrites`
 * flag), the chat loads `{ toolkits: ['github'], limit: 500 }` instead.
 */
const CHAT_GITHUB_READONLY_TOOL_SLUGS = [
  // Repo metadata
  'GITHUB_GET_A_REPOSITORY',
  'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
  // File/directory content
  'GITHUB_GET_REPOSITORY_CONTENT',
  'GITHUB_GET_THE_README',
  // Commits
  'GITHUB_LIST_COMMITS',
  'GITHUB_GET_A_COMMIT',
  // Issues
  'GITHUB_LIST_REPOSITORY_ISSUES',
  'GITHUB_GET_AN_ISSUE',
  // Pull requests
  'GITHUB_LIST_PULL_REQUESTS',
  'GITHUB_GET_A_PULL_REQUEST',
  // Search
  'GITHUB_SEARCH_CODE',
] as const
```

**Important — slug-verification step before committing:** Composio tool slugs are case-sensitive and not all of the above necessarily exist in this SDK version. Verify each slug exists by running the smoke script with `{ tools: [<slug>] }` (one round-trip per slug, or batch them in a single call). If any slug isn't recognized, find Composio's actual name from the smoke's full keys list and substitute. Record the final verified list in this Task 3 Step 3 by editing the plan file.

- [ ] **Step 4: Implement the swap**

Replace the block from `const session = await composio.create(...)` through the wrap-loop with:

```ts
const entityId = projectComposioEntityId(args.userId, args.projectId)

// Static, curated read-only GitHub tools instead of the v3 tool-router
// session. Tool names (GITHUB_GET_REPO, etc.) are what
// applyGithubRepoAllowlistToTools matches at the route layer; the
// tool-router session returned only meta-tools and was useless for
// name-based allowlists.
//
// Curated list (not `{ toolkits: ['github'], limit: 500 }`) to avoid
// exposing 500 tools including destructive ops. Phase B follow-up will
// add per-project opt-in for the full toolkit.
const rawTools = (await composio.tools.get(entityId, {
  tools: [...CHAT_GITHUB_READONLY_TOOL_SLUGS],
})) as ToolSet

console.log(
  '[composio-tools] static github toolset keys:',
  Object.keys(rawTools),
)

return rawTools
```

VercelProvider auto-binds `connectedAccountId` (verified GREEN in Task 0 Step 7). No connectedAccounts lookup needed.

- [ ] **Step 4: Run test, verify GREEN**

Run: `node --test --import tsx src/server/tools/composio-tools.test.ts`
Expected: PASS — stub returned `GITHUB_*` keys; the assertion is satisfied.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/composio-tools.ts src/server/tools/composio-tools.test.ts
git commit -m "feat(chat-tools): swap to composio.tools.get for GITHUB_* toolkit"
```

---

## Task 4: Delete dead code (`withConsistentComposioSession`, `REMOVED_COMPOSIO_TOOLS`, factory)

The static `tools.get` path returns zero `COMPOSIO_*` meta-tools. The wrappers and filter set that exist purely to manage those become dead.

**Files:**
- Modify: `src/server/tools/composio-tools.ts`

- [ ] **Step 1: Verify no external consumers of about-to-delete symbols**

```bash
grep -rn "withConsistentComposioSession\|resolveComposioSessionIdFactory\|REMOVED_COMPOSIO_TOOLS" src/
```

Expected: matches only inside `src/server/tools/composio-tools.ts`. If anywhere else, stop and reconcile first. (Pre-verified at plan-write time: only `composio-tools.ts` references these. Specifically confirmed `src/app/api/app/conversations/act/route.ts:17` imports only `createBrowserUnifiedTools`/`prewarmBrowserUnifiedTools`.)

- [ ] **Step 2: Delete**

Remove:
- `REMOVED_COMPOSIO_TOOLS` `Set` constant
- `resolveComposioSessionIdFactory` function (including its `composioSessionId` closure)
- `withConsistentComposioSession` function
- Any imports of `JsonRecord` if only those functions used it

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Run all unit tests**

```bash
node --test --import tsx 'src/**/*.test.ts'
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/server/tools/composio-tools.ts
git commit -m "refactor(chat-tools): remove dead tool-router-session wrappers"
```

---

## Task 5: Add dev-only cache-clear guard

The `composioCache` (10-minute TTL, module-scope `Map`) may survive Next dev HMR in some configurations. After the swap, a stale cached `ToolSet` from the previous session-pattern code could hide the change. Add a no-op-in-prod safeguard.

**Files:**
- Modify: `src/server/tools/composio-tools.ts`

- [ ] **Step 1: Add a dev-environment cache reset at module load**

At the bottom of the `composioCache` declaration block:

```ts
if (process.env.NODE_ENV !== 'production') {
  // Dev: clear any cached ToolSet at module load so changes here take
  // effect on the next chat turn without needing a hard restart. In prod,
  // the cache persists across requests as before.
  composioCache.clear()
  composioInFlight.clear()
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/tools/composio-tools.ts
git commit -m "chore(chat-tools): clear composioCache at module load in dev"
```

---

## Task 6: End-to-end verification (manual)

**Files:** none

- [ ] **Step 1: Hard-restart the dev server**

Save-and-hot-reload may not flush the module-scope cache. Kill + restart:

```bash
# In the dev-server terminal: Ctrl+C
pnpm dev
```

- [ ] **Step 2: Wait for `Convex functions ready!` and the Next.js ready banner.**

- [ ] **Step 3: In the browser, log in if needed, navigate to the same project we've been debugging (`Reliance Financial`, projectId `mh715nq1eaep590qkzhn4drm3x871s9a`).**

- [ ] **Step 4: Open the project's chat (the one whose tools come from `createBrowserUnifiedTools`). Send the prompt:**

```
what can you tell me about the reliance_underwriting_system repository?
```

- [ ] **Step 5: Watch the dev-server terminal for the diagnostic log**

Expected line (or similar):

```
[composio-tools] static github toolset keys: [
  'GITHUB_GET_A_REPOSITORY',
  'GITHUB_LIST_REPOSITORY_CONTENT',
  …
]
```

If the array contains `COMPOSIO_*` slugs or is empty: **STOP**. Rollback procedure (Step 7 below).

If the array contains `GITHUB_*` slugs: continue.

- [ ] **Step 6: Verify model behavior**

Expected: model invokes a `GITHUB_*` tool (visible in the chat as a tool call), and responds with actual GitHub data about the repo. Then ask about a NON-allowlisted repo — model should be blocked by the allowlist wrap and explain the scope.

- [ ] **Step 7: Rollback procedure (only if verification fails)**

If Step 5 shows `COMPOSIO_*` keys instead of `GITHUB_*`, revert just the swap + dead-code-deletion + cache-clear tasks:

```bash
# Identify the commit range:
git log --oneline -20

# Revert from the most recent through the swap (Tasks 3, 4, 5):
git revert <task5-sha> <task4-sha> <task3-sha>
```

The Task 0 smoke script, Task 1 baseline test, and Task 2 DI seam stay — they're useful groundwork even if Task 3's approach turns out to be wrong. After revert, re-open this plan and re-evaluate the spec against the actual smoke output.

- [ ] **Step 8: Run full verification suite**

```bash
pnpm typecheck
pnpm lint src/server/tools/composio-tools.ts src/server/tools/composio-tools.test.ts src/server/tools/tools/github-repo-allowlist.test.ts
node --test --import tsx 'src/**/*.test.ts'
```

Expected: all clean.

- [ ] **Step 9: No commit needed unless previous steps surfaced fixes.**

---

## Task 7: Remove the smoke script

**Files:**
- Delete: `scripts/composio-tools-smoke.ts`

- [ ] **Step 1: Delete + commit**

```bash
git rm scripts/composio-tools-smoke.ts
git commit -m "chore(chat-tools): remove one-shot smoke script after verification"
```

---

## Task 8: Open PR with regression-aware body

**Files:** none (GitHub-side)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin project-first-mcp-scope
```

- [ ] **Step 2: Open PR with the body template below**

```markdown
## Summary
- Replaced the Composio v3 tool-router session in chat (`composio.create(entityId)` + `session.tools()`) with the static-tools surface (`composio.tools.get(entityId, { toolkits: ['github'] })`).
- The GITHUB_* tools now appear in the chat session's toolset, so `applyGithubRepoAllowlistToTools` actually fires (it pattern-matches on `GITHUB_*` names, which the previous session-router toolset never contained).
- Deleted dead code that was specific to the tool-router pattern (`withConsistentComposioSession`, `REMOVED_COMPOSIO_TOOLS`).

## Why
Chat couldn't reliably invoke any GitHub tool, and the per-project repo allowlist was silently a no-op for chat. Root cause documented in spec § "Update 6".

## Regression scope
- **Other Composio toolkits are now unreachable from chat** (gmail, drive, slack, notion, linear, outlook, calcom, etc.). Acceptable per product decision; broaden as a separate effort.
- **`COMPOSIO_SEARCH_TOOLS` dynamic-discovery escape hatch is also gone.** The model has no path to non-GitHub toolkits from chat now.
- **No change to non-chat surfaces**: the repos-listing route (`/api/app/integrations/github/repositories`) still uses `composio.tools.execute` directly; OAuth flow, allowlist picker, and disconnect path are unchanged.

## Verification
- Dev-server diagnostic log shows: `[composio-tools] static github toolset keys: [ 'GITHUB_*', ... ]`
- Chat prompt about allowlisted repo → real GitHub data returned
- Chat prompt about non-allowlisted repo → blocked by allowlist wrap
- `pnpm typecheck` + `pnpm lint` + unit tests all green

## Test plan
- [ ] Chat in the test project asks about an allowed repo → succeeds
- [ ] Chat in the test project asks about a not-on-list repo → wrap blocks
- [ ] Connect/disconnect via integrations drawer still works
- [ ] Allowlist picker still works (no regression in UI)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 3: Return PR URL to the user**

---

## Plan Review Loop (already run)

This plan has been through one round of adversarial review (`compound-engineering:ce-adversarial-document-reviewer`). Findings were folded back in:

- D1 (test flake) — fixed by reordering: Task 2 DI seam lands before Task 3's failing test.
- D2 (verification doesn't reach chat path) — fixed by Task 6's explicit hard-restart + cache-clear + how-to-trigger-chat steps.
- D3 (Task 0 branch 2 under-specified) — fixed by Task 0 Step 1 requiring SDK signature lookup recorded inline.
- C1 (test hook ad-hoc) — fixed by DI through function arg instead of a `__setComposioFactoryForTests` back-channel.
- C2 (reorder allowlist baseline before swap) — fixed: Task 1 now establishes green baseline.
- C3 (caching not addressed) — fixed by Task 5 dev-only cache clear.
- G1 (no rollback) — fixed by Task 6 Step 7.
- G2 (no PR task / regression scope in body) — fixed by Task 8.

If a second adversarial pass surfaces new issues, repeat the loop.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-github-static-chat-tools.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — `superpowers:subagent-driven-development`. Fresh subagent per task, two-stage review between tasks, faster iteration. Good for this plan because Task 0 (smoke) branches the rest and benefits from a clean session per task.
2. **Inline Execution** — `superpowers:executing-plans`. Batch execution with checkpoints, single session. Good if you want to watch every step in this terminal.

**Which approach?**
