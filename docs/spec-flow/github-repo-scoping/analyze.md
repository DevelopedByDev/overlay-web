# Phase 4 — Cross-Artifact Consistency Analysis

**Status: GO** (after two inline corrections applied — see §6).

Artifacts reviewed:

- `docs/spec-flow/github-repo-scoping/spec.md`
- `docs/spec-flow/github-repo-scoping/clarify.md`
- `docs/spec-flow/github-repo-scoping/plan.md` (with §6 rewritten via commit `c5d179c` for the drawer pivot)
- `docs/spec-flow/github-repo-scoping/tasks.md`

Cross-checked against the actual codebase on branch `spec-flow/github-repo-scoping` (base `fea6917` + dep-fix `bf682cd`).

---

## 1. Coverage matrix

Every spec item traces to plan section(s) and task ID(s). No gaps.

| Spec item | Plan section | Tasks |
|---|---|---|
| Story 1 — Configure allowlist | §6, §10 | 15, 16, 17, 18 |
| Story 2 — Enforce allowlist | §4, §9 | 8, 14 |
| Story 3 — No allowlist = full access | §1, §4, §7 | 14 |
| Story 4 — Populate picker from GitHub | §5, §10 | 12, 13, 18 |
| Story 5 — Agent informed of scope | §7, §10 | 14 |
| Story 6 — Clear / expand allowlist | §6, §10 | 18 |
| Success Criterion 1 — Blocked call, no egress | §4, §9 | 7, 8, 14 |
| Success Criterion 2 — Allowed call passes | §4, §9 | 8, 14 |
| Success Criterion 3 — Unset = permissive | §1, §4, §7 | 14 |
| Success Criterion 4 — Multi-project isolation | §1, §9 (E2E manual) | covered by 8 + 14; E2E manual at QA |
| Success Criterion 5 — Repo picker populated | §5, §6, §10 | 13, 18 |
| Success Criterion 6 — Agent context present | §7, §10 | 14 |
| Success Criterion 7 — UI round-trip | §6, §10 | 18 |
| Decision 1 — Permissive default | §1, §4, §7 | 14 |
| Decision 2 — Inclusive list | §2, §4, §9 | 2, 3, 8 |
| Decision 3 — Hard refusal | §4, §8, §9 | 8, 14 |
| Decision 4 — Composio + manual fallback | §5, §6, §10 | 13, 18 |
| Decision 5 — owner/name strings | §2, §4, §9 | 2, 3, 8 |
| Decision 6 — Persist across disconnect | §2, §11 | 1, 4 (implicit; schema never clears) |
| Decision 7 — Reads + writes | §4, §9 | 8 |
| Decision 8 — No lockdown toggle | §6, §11 | 18 |
| Decision 9 — Picker hidden when toolkit off | §6, §10, §11 | 18 |

---

## 2. Contradictions

None detected. The three artifacts present a consistent narrative across behavior, architecture, and task ordering.

---

## 3. Terminology drift

None. "Allowlist" / "policy" / "allowed repos" are used in distinct, well-defined contexts (state vs. resolved object vs. user-facing label). "Settings drawer" and "sections" are consistent post-pivot. "Repo-scoped" vs. "user-scoped" Composio tool calls are explicitly distinguished in plan §4.

---

## 4. Architectural risks

### Risk 1 [Low — forward-looking note]

**Per-tool wrap interaction with Composio cache.** Plan §1 lines 105–113 correctly state that the 10-minute Composio cache (`composio-tools.ts:142`) stores the **unscoped** raw tool set, and the per-turn wrap is applied *after* cache retrieval in `act/route.ts`. This is correct and avoids scope-leakage across projects sharing a user's GitHub connection.

What the plan does NOT explicitly state: per-turn wrapping is **load-bearing** and cannot be cached per project, because the allowlist can change between turns (clarify Q6 + Story 6 — adding or removing repos must take effect on the very next turn). If a future optimization caches wrapped tools per project, this invariant must be preserved.

**Mitigation:** add a code comment on the wrap application in Task 14 noting "per-turn wrap is load-bearing; do not cache per-project." Low-priority forward-looking guard.

### Risk 2 [Low — known unknown, handled gracefully]

**Composio `LIST_REPOSITORIES` response shape.** Plan §11 item 4 acknowledges the live response may diverge from the documented shape. The route handler in Task 13 maps response → small DTO at the boundary, so the rest of the system is unaffected. No code-correctness risk; the DTO boundary already de-risks this.

**Mitigation:** Task 13's implementation should verify and log any shape divergence on first live exercise. Already accounted for in error-handling table (§8).

### Verified, not a risk

- **AI SDK v6 interception surface.** Re-verified from `node_modules/ai/dist/index.d.ts`: `experimental_onToolCallStart` / `experimental_onToolCallFinish` are observer callbacks (cannot cancel, cannot rewrite result). No `prepareStep` / `experimental_prepareTool` / abort hook exists. Per-tool `execute` wrap is the only blocking-capable surface. Plan §1 and §4 are correct.
- **Backward compatibility (Story 3).** Convex schema currently has no `githubRepoAllowlist` field (`convex/schema.ts` lines 293–305). Plan stores `undefined` when the normalized list is empty (§3). Enforcement wrap is identity when `policy.enabled === false` (§4). Agent context note is conditional on `policy.enabled === true` (§7). No migration needed.
- **Zero-egress guarantee (Success Criterion 1).** The wrap short-circuits before invoking the original `execute`, and Composio's network call happens entirely inside that original. Task 7 pins this with an `executeStub.mock.callCount() === 0` assertion. Chain is sound.
- **Drawer push-layout responsiveness.** Plan §6 specifies fallback to overlay mode at `≤ 768px` via `window.matchMedia`. The `ProjectsView.tsx` container is a flex column today, so adding a flex-row wrapper around the hub content area is non-invasive.

---

## 5. Task soundness

All 18 tasks well-formed. Each declares `Depends on:`. Each is sized for one TDD cycle. Tests precede the implementation they cover (e.g. Task 5 → 6, Task 7 → 8).

**Parallel kickoff (`Depends on: none`):** Tasks 1, 2, 5, 9. Verified non-overlapping: Task 1 (schema field) touches only `convex/schema.ts`; Task 2 (shared normalizer scaffold + types) touches a new file; Task 5 (enforcement test scaffold) touches a new test file; Task 9 (overlay-app-core types) touches `packages/overlay-app-core/src/projects.ts`. No shared state between the four leaves.

**Mid-layer:** Tasks 3, 6, 12, 15 each depend on exactly one kickoff task. No hidden cross-deps.

**Final gather:** Task 18 (`ProjectsView.tsx` end-to-end wiring) depends on prior layers and is appropriately L-sized. Single sequential gather point.

No dependency declarations look over- or under-stated.

---

## 6. Settings-tab leftover wording (drawer pivot audit)

Grepped all three artifacts for `"Settings tab"`, `"Settings Tab"`, `ProjectSettingsTabContent`. Findings:

| File:line | Status | Action |
|---|---|---|
| `spec.md:44` (Story 1 user-story sentence) | **Real leftover** | **FIX applied during analyze:** rewritten to "open a project's settings drawer, find the GitHub repositories section". |
| `plan.md:465` | Intentional (deviation discussion) | Keep. |
| `plan.md:493` | Intentional ("Story 1's acceptance criterion uses the phrase…") | Keep. |
| `plan.md:679` | **Real leftover** | **FIX applied during analyze:** rewritten to "Re-opening the settings drawer to the GitHub repositories section". |
| `plan.md:892` | Intentional ("Do NOT extend `ProjectHubTab` (no Settings tab — drawer…)") | Keep. |
| `plan.md:942` | Intentional ("drawer shell + section registry replace the single Settings tab content file") | Keep. |
| `plan.md:953` | Intentional ("Settings tab wording. Confirmed by orchestrator…") | Keep. |
| `tasks.md` | No matches (verified) | Clean. |
| Code (`packages/overlay-app-core/src/projects.ts`) | No `ProjectHubTab` entry for `'settings'` (verified) | Clean. |

Both real leftovers were corrected as inline patches as part of this analyze pass. No structural change required.

---

## 7. Go / No-Go recommendation

### **GO**

The three artifacts are mutually consistent after the two inline corrections. Phase 5 can execute end-to-end from `tasks.md` without further refinement.

**Confidence:** 9/10.

**Why not 10:** Risk 1 (per-turn wrap invariant) is documented but not enforced by a test. Adding an explicit assertion in Task 7 that the wrap function is called fresh per turn would close this — but it's a forward-looking guard, not a v1 blocker.

**Inline corrections applied in this pass:**

1. `spec.md:44` — Story 1 user-story sentence updated from "open a project's Settings tab, navigate to the GitHub integration row" → "open a project's settings drawer, find the GitHub repositories section".
2. `plan.md:679` — Round-trip wording updated from "Re-opening the project's Settings tab" → "Re-opening the settings drawer to the GitHub repositories section".

No structural changes. Phase 5 ready.
