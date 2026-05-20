# Clarifications Needed: GitHub Repository Scoping

These are decisions that must be made before architecture begins. Each hinges on a product or operational tradeoff that cannot be resolved from code alone.

---

### 1. What is the default when no allowlist is configured?

**Why this matters:** This is the single highest-impact backward-compatibility decision. Every existing project that has GitHub enabled will hit this default on day one. Getting it wrong either silently breaks existing users (secure default) or ships a feature that feels optional and gets ignored (permissive default).

**Options:**
- A. Permissive — no allowlist means all repositories the connected GitHub account can reach are available. Matches current behavior exactly; zero risk of regression.
- B. Secure — no allowlist means zero repositories are accessible; the project owner must explicitly configure repos before GitHub tools will work. Forces intention but breaks existing setups.
- C. Prompted — no allowlist means all repos are accessible, but the agent and the UI surface a one-time nudge to configure scoping. Permissive behavior, visible nudge.

**Recommendation:** A. Permissive default. Existing users must not see a regression. The feature is valuable when opted into; making it a forced gate on day one will create support noise and undermine trust in the system.

---

### 2. Should the allowlist be inclusive ("only these repos") or exclusive ("all except these")?

**Why this matters:** Inclusive and exclusive lists have opposite failure modes at scale. An inclusive list is safe by default as it grows (adding a new repo to GitHub does not automatically expose it). An exclusive list requires the user to actively block new repos, which is easy to forget. However, inclusive lists require more initial setup effort.

**Options:**
- A. Inclusive only — the list names the repos the project MAY access. Absent from the list means blocked.
- B. Exclusive only — the list names the repos the project MUST NOT access. Absent from the list means allowed.
- C. Inclusive with "all" shorthand — default is all; once you add anything to the list it becomes inclusive.
- D. User-selectable mode — the project owner chooses inclusive or exclusive per project.

**Recommendation:** A. Inclusive only. Exclusive lists are confusing to reason about in security contexts ("what is this project allowed to do?") and create a subtle audit trap as the GitHub account grows. An inclusive list with a permissive empty-state (question 1) gives the right answer to both "what's the blast radius?" and "how do I lock this down?"

---

### 3. What happens when the model calls a GitHub tool with a non-allowed repo?

**Why this matters:** The enforcement mode determines whether the user sees the refusal, whether the model can recover, and whether there is any observable signal for debugging. A silent drop is invisible; a hard refusal is debuggable but may confuse the agent.

**Options:**
- A. Hard structured refusal — the tool call is intercepted and a tool result is returned to the model that describes the refusal (e.g. "Repository `owner/repo` is not in this project's allowed list"). The model sees this and can self-correct or inform the user.
- B. Silent tool removal — before the turn begins, GitHub tools are stripped from the model's tool set for repos not on the list. The model never tries; it also never knows why.
- C. Log-only — the call is allowed through but a warning is written to the server log. Enforcement is informational only.
- D. Hard error to user — the call is refused and the UI surfaces an error directly to the user, bypassing the model.

**Recommendation:** A. Hard structured refusal. This is the only mode that gives the model enough signal to self-correct ("you asked me to act on X but that repo is not in scope for this project") and is observable in conversation history. Silent removal (B) would make debugging extremely difficult. Log-only (C) is not enforcement. Option D bypasses the model entirely and produces a poor UX.

---

### 4. Where does the repository list come from for the picker?

**Why this matters:** The picker must show real data. The source determines latency, reliability, failure modes, and whether pagination is needed. Composio's `LIST_REPOSITORIES` is the path of least resistance given the existing Composio surface, but it may be paginated or rate-limited.

**Options:**
- A. Composio `LIST_REPOSITORIES` action only — call it at picker open time; display results; handle pagination if present.
- B. GitHub API directly — call the GitHub REST API with the user's OAuth token retrieved from Composio's credential store.
- C. Composio with manual-entry fallback — attempt Composio first; if it fails or times out, allow the user to type `owner/name` strings manually.
- D. On-demand search — show a search box instead of a full list; query `LIST_REPOSITORIES` filtered by the search string.

**Recommendation:** C. Composio with manual-entry fallback. It reuses the existing integration surface (no new credential plumbing), and the fallback handles failure gracefully without blocking the user. Manual entry also covers private repos that might not appear in a paginated list.

---

### 5. How should repo identity be stored?

**Why this matters:** The stored identifier is what the enforcement layer compares against tool call arguments. If repos are renamed on GitHub or transferred between owners, a stored `owner/name` string becomes stale. A numeric GitHub ID survives renames but is not human-readable and requires a lookup to display.

**Options:**
- A. `owner/name` string only — simple, human-readable, easy to match against tool arguments. Breaks on rename or transfer.
- B. GitHub numeric ID only — stable across renames, but requires an API call to resolve a display name in the UI.
- C. Both — store numeric ID as the stable key and `owner/name` as a display hint; enforcement uses the numeric ID; UI shows the display hint.
- D. Full URL — `https://github.com/owner/name`. Verbose; same rename problem as A; no benefit over A.

**Recommendation:** A. `owner/name` string for v1, following YAGNI. Repo renames are rare. Numeric ID storage adds complexity (lookup plumbing, two-field storage) for a failure mode that most users will never encounter. If rename handling becomes a support issue, it can be added in v2.

---

### 6. When GitHub is disconnected, what happens to the allowlist?

**Why this matters:** If a user disconnects and reconnects GitHub, the allowlist state determines whether they need to reconfigure. Clearing on disconnect is safe but requires re-setup. Persisting on disconnect is convenient but could be confusing if the reconnected account has different repo access.

**Options:**
- A. Persist — the allowlist survives disconnect/reconnect. On reconnect, the previously scoped repos are still set. The user may need to update if the new connection has different access.
- B. Clear — disconnecting GitHub clears the allowlist for all projects that had it configured. On reconnect, the user starts fresh.
- C. Flag as stale — the allowlist data is kept but marked as stale; the UI warns the user that it may need to be verified after reconnect.

**Recommendation:** A. Persist. The user's intent (which repos should this project touch) is independent of the credential state. Clearing on disconnect would erase deliberate configuration and require re-setup. The reconnected account will typically have the same or a superset of repo access. If it has less, enforcement naturally handles it (blocked calls).

---

### 7. Does the allowlist apply equally to read and write GitHub tool actions?

**Why this matters:** The project owner's primary concern is likely preventing writes to the wrong repo (pushes, PR creation, file edits). Blocking reads (e.g. listing issues in a repo) is more aggressive and may be unexpected. However, reads can still leak information.

**Options:**
- A. Apply to all actions — both read and write GitHub tool calls are subject to the allowlist. Consistent; no exceptions to reason about.
- B. Apply to write actions only — read-only calls (list issues, read file, search commits) bypass the allowlist; mutating calls (push, create PR, edit file) are blocked for non-allowed repos.
- C. Configurable per project — the project owner can choose read+write restriction or write-only restriction.

**Recommendation:** A. Apply to all actions. Uniform enforcement is simpler to reason about, simpler to implement, and simpler to explain. If the project should not touch a repo, it should not read from it either. Option C introduces UI complexity that violates KISS for a v1 feature.

---

### 8. Should there be a "lockdown" mode that blocks all GitHub tool calls if no allowlist is configured?

**Why this matters:** A power user may want to explicitly opt into a strict posture where the project's agent cannot use any GitHub tools until repos are deliberately configured. Without this, the only way to enforce "no access" is to disable the GitHub toolkit entirely.

**Options:**
- A. No lockdown mode — the permissive default (question 1, option A) is the only no-allowlist behavior. To block GitHub entirely, the user disables the GitHub toolkit toggle.
- B. Optional lockdown — a toggle in project settings labeled something like "Require repo allowlist before GitHub tools activate" changes the default to blocked-until-configured for that project only.

**Recommendation:** A. No lockdown mode. The existing per-project toolkit toggle already satisfies this need: disabling GitHub entirely is the "lockdown" for users who want it. Adding a second "block until configured" toggle creates redundancy and unclear interaction with the main toggle. YAGNI applies.

---

### 9. What is the picker UX when the GitHub toolkit is disabled for the project?

**Why this matters:** The repository allowlist only applies when GitHub is enabled for the project. If the user navigates to project settings while GitHub is toggled off, showing the repo picker could be confusing (is this saving something that has no effect?) or it could be helpful (configure scope in advance, then enable).

**Options:**
- A. Hide picker when GitHub is disabled — the repo picker only appears in settings when the GitHub toolkit is enabled for that project.
- B. Show picker but disable it — the picker is visible but non-interactive when GitHub is toggled off. A tooltip explains why.
- C. Show picker regardless — the picker is always available; configuration is independent of the enabled state.

**Recommendation:** A. Hide picker when GitHub is disabled. The allowlist is meaningless when the toolkit is off, and showing a disabled but visible control adds cognitive load for no benefit. This is also the simplest implementation.
