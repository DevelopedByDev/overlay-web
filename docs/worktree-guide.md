# Worktree Guide for `overlay-landing`

`overlay-landing` is a git submodule inside `overlay-mono`. Its git-dir lives at
`overlay-mono/.git/modules/overlay-landing`. Worktrees are managed from inside the
`overlay-landing` checkout.

All `git worktree` commands run from:
```
/Users/divyanshlalwani/Downloads/overlay-mono/overlay-landing
```

Worktrees land in:
```
/Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>
```

---

## 1. Create a new worktree

```bash
git worktree add /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name> -b <branch-name>
```

Then set up the worktree for dev (only needed once per worktree):

```bash
ln -s /Users/divyanshlalwani/Downloads/overlay-mono/overlay-landing/.env.local \
      /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>/.env.local

ln -s /Users/divyanshlalwani/Downloads/overlay-mono/overlay-landing/node_modules \
      /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>/node_modules
```

> ⚠️ Only run `ln -s` for `node_modules` when the target does **not** already exist in the
> worktree. If it exists, the symlink lands *inside* it instead of replacing it.

---

## 2. Run a dev server in a worktree

Each worktree needs a **different port** to avoid conflicts:

```bash
cd /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>
npm run dev -- --port 3001   # use 3002, 3003, etc. for additional worktrees
```

---

## 3. Commit changes in a worktree

The simplest approach — `cd` into the worktree and run git normally:

```bash
cd /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>
git status
git add -p
git commit -m "feat: ..."
```

If you need to run git against a worktree **from outside it** (e.g. from the main checkout),
use explicit flags to avoid submodule git-dir confusion:

```bash
git \
  --git-dir=/Users/divyanshlalwani/Downloads/overlay-mono/.git/modules/overlay-landing/worktrees/<name> \
  --work-tree=/Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name> \
  status
```

---

## 4. List all worktrees

```bash
git worktree list
```

---

## 5. Remove a worktree when done

```bash
git worktree remove /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>
```

If that fails due to untracked or modified files:

```bash
git worktree remove --force /Users/divyanshlalwani/conductor/workspaces/overlay-landing/<name>
```

Then delete the branch if you're finished with it:

```bash
git branch -d <branch-name>
```

---

## Current worktrees

| Name | Branch | Notes |
|---|---|---|
| *(main)* | `main` | `overlay-landing/` in the monorepo |
| `beirut` | `DevelopedByDev/chat-perf-streaming-ux` | at `66b15ca` |
| `jackson` | `DevelopedByDev/gen-ui-experimental` | at `66b15ca`, has uncommitted gen-ui changes |
| *(codex)* | detached HEAD `389c15e` | managed by `~/.codex/worktrees/` |
