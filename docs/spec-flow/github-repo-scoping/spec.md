# GitHub Repository Scoping for Projects

**Summary:** A project owner can restrict which GitHub repositories a project's agent is permitted to act on, so that a single connected GitHub account can serve many projects without cross-contamination.

---

## User Value

Today, connecting GitHub grants the agent access to every repository the user's GitHub account can reach. When a user creates multiple projects — one for a client codebase, one for internal tooling, one for personal work — there is no way to prevent the agent in project A from touching repos that belong to project B. The only available control is an all-or-nothing toggle: enable or disable the entire GitHub toolkit for a project.

This creates two failure modes:

1. A user gives a project agent a broad instruction ("fix bugs in my repos") and the agent reaches repos it should never touch.
2. A user hesitates to enable GitHub at all in a project because they cannot bound the blast radius.

Repository scoping closes this gap without requiring any change to how GitHub is connected. The OAuth installation is unchanged; the scoping is enforced inside the product, at tool-call time.

---

## Goals

- Allow the project owner to specify an inclusive list of repositories that a given project is permitted to act on.
- Enforce that list at tool-call time: any GitHub tool call referencing a repository outside the allowlist is refused before it reaches GitHub.
- Expose the allowlist in project settings, next to the existing integration toggles, in a way that is discoverable without documentation.
- Keep the default behavior safe and backward-compatible for existing projects that currently have GitHub enabled.
- Surface the configured allowlist to the agent in its context so it does not attempt actions it cannot complete.

---

## Non-Goals (v1)

- **Per-resource scoping for non-GitHub integrations.** The design is GitHub-only. No patterns established here will be generalized to other toolkits (e.g. Google Drive folders, Notion workspaces) in this release.
- **Per-action restrictions.** The allowlist governs which repositories the agent may touch. It does not restrict which GitHub actions (read vs. write, PR vs. issue vs. push) the agent may perform within an allowed repository. Action-level restrictions are out of scope.
- **OAuth scope or GitHub App installation changes.** This feature requires no re-authorization of the GitHub OAuth flow, no changes to the Composio connection path, and no modification to the GitHub App installation on the user's GitHub account.
- **Team or organization-level admin policies.** Workspace-level enforcement or admin-imposed repo restrictions are out of scope for v1.
- **Audit logging or access reports.** Tracking which repos were accessed per project is not part of this release.

---

## User Stories

### Story 1 — Configure a repository allowlist for a project

As a project owner, I want to open a project's settings drawer, find the GitHub repositories section, and select which repositories this project is allowed to access, so that the agent in this project cannot touch any other repository.

**Acceptance Criterion:** Given GitHub is connected and a project has GitHub enabled, the project owner can open project settings and see a repository picker for GitHub. After selecting one or more repositories and saving, the saved list is reflected immediately in the settings UI without a page reload.

---

### Story 2 — Enforce the allowlist on every GitHub tool call

As a project owner, I want any GitHub tool call that references a repository outside my configured allowlist to be refused, so that I can trust the agent's blast radius is bounded regardless of what instruction it receives.

**Acceptance Criterion:** Given a project has a non-empty repository allowlist, if the agent attempts to call any GitHub tool with a repository argument that is not on the allowlist, the call is refused before it reaches GitHub. The agent receives a structured refusal message identifying the blocked repository, not a GitHub API error. No GitHub API request is made.

---

### Story 3 — No allowlist means full access (backward compat)

As an existing user who already has GitHub enabled for a project, I want my existing setup to continue working exactly as it does today when I have not configured any repository allowlist, so that this feature does not break anything for me.

**Acceptance Criterion:** Given a project has GitHub enabled and no repository allowlist configured, GitHub tool calls behave identically to how they behaved before this feature shipped. No prompt or blocking occurs. The project owner sees an empty/unconfigured state in the repository picker, not a zero-repo block.

---

### Story 4 — Populate the repository picker from GitHub

As a project owner, I want the repository picker to show me the repositories my GitHub account actually has access to, so that I do not have to type repo identifiers manually.

**Acceptance Criterion:** Given GitHub is connected, when the project owner opens the repository picker, the list of available repositories is fetched and displayed. The owner can search/filter the list by name. The list reflects the actual set of repositories the connected GitHub account can reach.

---

### Story 5 — Agent is informed of its repo scope

As a project owner, I want the agent to know which repositories it is allowed to use before it starts working, so that it does not waste a tool call attempting something it cannot complete.

**Acceptance Criterion:** Given a project has a non-empty repository allowlist, the agent's context for that project includes a statement of which repositories it is permitted to access. The agent does not need to discover this by attempting a rejected call.

---

### Story 6 — Clear or expand the allowlist

As a project owner, I want to be able to add repositories to, remove repositories from, or clear the entire repository allowlist for a project at any time, so that I can adjust scope as the project's needs change.

**Acceptance Criterion:** Given a project has a repository allowlist, the project owner can return to project settings, modify the list (add, remove, or clear all), and save. The enforcement immediately reflects the new list on the next chat turn. Clearing the list restores unrestricted access (Story 3 default).

---

## Success Criteria

The following observable conditions must all be true for this feature to be considered complete:

1. **Blocked call, no network egress:** A tool call referencing a non-allowed repo returns a structured refusal to the model. Network monitoring shows zero outbound requests to GitHub or Composio for that call.
2. **Allowed call passes through:** A tool call referencing an allowed repo proceeds normally and returns a real GitHub response.
3. **Unset allowlist is permissive:** A project with no allowlist configured passes all GitHub tool calls through, identical to pre-feature behavior.
4. **Single-project isolation:** Two projects sharing the same connected GitHub account, each with a different allowlist, each only see and act on their own configured repos.
5. **Repo picker populated:** The repository picker in project settings shows real data from the connected GitHub account, not a static or empty list.
6. **Agent context present:** When an allowlist is set, inspecting the system prompt or context injected at the start of a chat turn reveals the allowed repository list.
7. **UI round-trip:** A list of repos saved in settings is still shown as selected when the project owner re-opens settings.

---

## Scope Boundaries

### In scope for this PR

- A per-project repository allowlist stored alongside existing project configuration.
- A repository picker UI inside project settings, beneath or alongside the existing GitHub integration toggle.
- Server-side enforcement of the allowlist at tool-call time before any GitHub API request is made.
- A mechanism to fetch and display the user's available repositories (via Composio `LIST_REPOSITORIES` or equivalent) to populate the picker.
- Injection of the allowlist into the agent's context at the start of a chat turn.
- Backward-compatible default: no allowlist means no change in behavior.

### Out of scope for this PR

- Generalizing the allowlist pattern to any other integration.
- Restricting which GitHub actions (read/write/admin) are available within an allowed repo.
- Any change to the GitHub OAuth connection flow or the Composio account linkage.
- Audit logs, access reports, or usage analytics at the repo level.
- Team or org admin enforcement.
- Behavior when GitHub is disconnected while an allowlist exists (see open questions).

---

## Resolved Decisions

The following decisions were resolved during clarify review and lock in the behavior described above. Each cross-references the question in `clarify.md`.

1. **Empty allowlist is permissive (clarify Q1, option A).** A project with no allowlist configured grants access to every repository the connected GitHub account can reach. Matches current behavior exactly. No regression for existing users.

2. **Inclusive list semantics (clarify Q2, option A).** The allowlist names the repositories a project MAY access. Any repo not on the list is blocked. There is no exclusive ("deny") variant.

3. **Hard structured refusal on blocked calls (clarify Q3, option A).** A GitHub tool call referencing a non-allowed repository is intercepted before egress. The model receives a structured tool result identifying the blocked repository so it can self-correct or inform the user. No silent drops; no log-only warnings.

4. **Repository list source: Composio with manual-entry fallback (clarify Q4, option C).** The picker calls Composio's `LIST_REPOSITORIES` action on open. If that call fails or times out, the user may type `owner/name` strings manually. Composio is the primary path; manual entry is the safety net.

5. **Repo identity stored as `owner/name` string (clarify Q5, option A).** YAGNI on numeric GitHub IDs. Renames are rare and can be handled in a future iteration if it becomes a real support issue.

6. **Allowlist persists across GitHub disconnect (clarify Q6, option A).** The user's intent is independent of credential state. On reconnect, the saved list applies again. If the new connection has narrower access, enforcement naturally handles it.

7. **Allowlist applies to both reads and writes (clarify Q7, option A).** Uniform enforcement. If a project is not allowed to act on a repo, it cannot read from it either.

8. **No separate "lockdown" toggle (clarify Q8, option A).** The existing per-project GitHub toolkit toggle already serves as the kill-switch. Adding a second toggle that means "block until configured" would be redundant.

9. **Repo picker is hidden when the GitHub toolkit is disabled for the project (clarify Q9, option A).** The allowlist is meaningless without an enabled toolkit; showing a disabled control adds cognitive load with no benefit.
