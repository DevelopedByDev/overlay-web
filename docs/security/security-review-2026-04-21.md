# Overlay Web Security Deep Dive (Black-Hat Perspective)

**Date:** 2026-04-21  
**Reviewer mode:** Static code audit focused on practical exploitability  
**Scope requested:** API keys, WorkOS auth, Stripe billing, Convex user-data flows, prompt-injection/agent attacks, plus adjacent attack surface.

---

## Executive summary

Your security posture is already above average in several areas (signed+encrypted session cookies, WorkOS JWT verification, Stripe webhook dedupe, server-secret gating for sensitive Convex paths). However, there are still **serious exploit paths** a capable attacker could abuse.

### Top risks (priority order)

1. **Stored/Reflected script execution via unsandboxed `<iframe>` rendering in file preview flows** (High).
2. **Prompt-injection-to-action risk in agent/tool orchestration** when high-risk tools are exposed in a turn (High).
3. **Sandbox command/network guardrails are bypassable with encoding/obfuscation tricks** if Daytona egress policy is not hard-deny at infra layer (High if infra not strict, Medium otherwise).
4. **Broad internal API surface (`/api/convex/*`) can become a privilege escalation vector if any Convex function is accidentally under-protected** (Medium/High, architecture risk).
5. **Token and session-transfer attack surface remains sensitive to client compromise and log hygiene** (Medium).

---

## Methodology

- Reviewed security-critical Next.js routes and middleware.
- Reviewed WorkOS session/token lifecycle and signature/crypto handling.
- Reviewed Stripe checkout + verification + webhook paths.
- Reviewed Convex mutations/queries that gate by `serverSecret` or access token.
- Reviewed model/tool execution pipeline and prompt-injection guardrails.
- Reviewed file ingestion/preview paths for XSS/SSRF/content confusion.

This is a **static audit**; no live penetration test or external infrastructure probing was performed.

---

## Findings

## 1) High: XSS-capable document preview surface via unsandboxed iframe

### What I found
File preview renders PDF-like content in an iframe without a `sandbox` attribute when `content` begins with `http://`, `https://`, `data:`, or `blob:`.

### Why this matters
If an attacker can store or influence `content` so that it resolves to active HTML/JS payload (e.g., crafted data URL or hostile remote payload), they may execute script in app context and perform authenticated actions on behalf of users.

### Black-hat exploit concept
- Upload/insert crafted file data that resolves to active iframe content.
- Victim opens file preview.
- Malicious script triggers authenticated same-origin actions (or phishing overlay, clickjacking-style UI deception, session abuse via victim browser context).

### Evidence
- `src/components/app/FileViewer.tsx` iframe rendering accepts `data:` and does not sandbox.

### Recommended remediation
- **Immediate:** add `sandbox` to iframe with minimal permissions (ideally none, or only what is truly required).
- **Immediate:** hard-block `data:` for iframe previews unless MIME/type is strictly validated server-side as PDF bytes.
- **Immediate:** force file content route to return `Content-Type: application/pdf` + `X-Content-Type-Options: nosniff` for PDF proxy responses.
- **Short term:** render PDFs through a hardened PDF viewer component instead of arbitrary iframe src.

---

## 2) High: Prompt-injection can still drive high-risk actions once tool is exposed

### What I found
System notes correctly warn models to treat retrieved/web/file content as untrusted. But the design still allows autonomous execution of powerful tools (browser automation, Daytona sandbox, note mutation, memory mutation, etc.) when exposed for that turn.

### Why this matters
Prompt injection is not prevented by text instructions alone. If a user request naturally exposes a risky tool (e.g., browser or sandbox), malicious content in retrieved docs/web pages can socially steer the model into abusive follow-up actions.

### Black-hat exploit concept
- Attacker plants malicious instruction in a web page or shared document.
- User asks for a task that enables risky tools.
- Model follows attacker content and executes unintended actions (exfiltration, destructive note edits, automated account interactions).

### Evidence
- Tool exposure is heuristic/intent-based (`allowedOverlayToolIdsForTurn`) and then direct execution is permitted.
- High-risk protections are mostly policy text (`HIGH_RISK_TOOL_AUTHORIZATION_NOTE`), not enforced runtime authorization checkpoints.

### Recommended remediation
- **Critical control:** require **explicit user confirmation gates** before executing high-risk tool classes (browser automation actions, file deletion/mutation, external POST/transaction-like actions, sandbox commands with network).
- Add a **policy engine** outside model output: enforce allow/deny by action class, destination domain, data sensitivity, and user-approved scope.
- Add **tool call risk scoring** and reject/hold suspicious calls (exfiltration patterns, credential targets, mass deletion intents).
- Introduce **per-tool scoped capabilities** per task with expiry (capability tokens), not just prompt-time instructions.

---

## 3) Medium/High: Daytona command validation is regex-based and bypassable

### What I found
The command validator blocks known internal hosts/IP ranges by regex string matching in command text.

### Why this matters
Regex deny-lists are bypassable (encoded IPs, DNS indirection, alternative notations, curl config indirection, chained scripts). If infra egress is not strict, an attacker can still reach internal targets.

### Black-hat exploit concept
- Encode internal targets in non-obvious format.
- Fetch payload/tooling that then pivots to blocked destinations.
- Use chained shell scripts where blocked literal never appears in initial command string.

### Evidence
- `src/app/api/app/daytona/run/route.ts` `BANNED_COMMAND_HOSTS` + textual checks.

### Recommended remediation
- Treat app-level validation as non-authoritative.
- Enforce **network egress allowlist at Daytona/container runtime** (default deny).
- Disable metadata/internal CIDR routes at network layer, not app layer.
- Run sandboxes with no cloud credentials, no sensitive env vars, no host mounts, and strict seccomp/apparmor/profiles.

---

## 4) Medium: Broad `/api/convex/*` proxy increases blast radius of auth mistakes

### What I found
A generic proxy forwards arbitrary Convex query/mutation/action payloads to backend.

### Why this matters
Even with middleware/session checks, this endpoint creates a large attack surface: a single under-protected Convex function can become reachable immediately through a generic pipe.

### Black-hat exploit concept
- Enumerate Convex function names/args from OSS codebase.
- Call vulnerable function through proxy with crafted payload.
- Escalate via any missed auth/ownership check in backend function.

### Evidence
- `src/app/api/convex/[type]/route.ts` forwards arbitrary body to Convex endpoint.

### Recommended remediation
- Replace generic proxy with **explicit allowlisted route handlers** for only required operations.
- Add server-side schema validation and per-function auth policy checks in Next layer.
- Add security telemetry for unusual Convex path invocations.

---

## 5) Medium: Session transfer and native refresh flows are high-value token targets

### What I found
Session transfer endpoints and native refresh route correctly use short TTL / code challenge / rate limits, but they still process bearer-grade artifacts that are highly sensitive if leaked from clients or logs.

### Why this matters
Desktop/mobile bridge flows are common breach points (logs, deep links, malware on endpoint, clipboard leakage).

### Black-hat exploit concept
- Harvest transfer token or refresh token from compromised device/logs.
- Redeem quickly before expiry.
- Persist session access through refresh.

### Evidence
- `src/app/api/auth/desktop-link/route.ts`
- `src/app/api/auth/native/refresh/route.ts`

### Recommended remediation
- Bind transfer tokens to **device fingerprint + one-time nonce + issuer context**.
- Consider mTLS or signed client attestations for native refresh endpoints.
- Add anomaly detection: geo/device impossible travel + refresh-token reuse alerts.
- Rotate refresh tokens aggressively and revoke on suspicious patterns.

---

## 6) Medium: Open-source architecture transparency lowers attacker cost

### What I found
Repo structure and route/function names make attack graph reconstruction straightforward.

### Why this matters
Open source is good, but security-through-transparency means you must assume perfect adversary knowledge.

### Recommended strategy (without abandoning OSS)
- Keep app code open, but **move sensitive orchestration to private service**:
  - Tool policy engine
  - Risk scoring and action approval service
  - Secrets broker / key vault integration logic
  - Fraud/abuse detectors
- Keep internal endpoint contracts undocumented publicly where possible.
- Add honey endpoints/telemetry for reconnaissance detection.

---

## Additional hardening roadmap (high impact)

## A) Authentication / session security
- Enforce strict cookie flags everywhere (`HttpOnly`, `Secure`, `SameSite=Lax/Strict`, path scoping).
- Add global session invalidation support (server-side session version or revocation list).
- Add device/session management UI for users (list + revoke sessions).
- Add mandatory MFA for admin/support/internal operations.

## B) API key and secret management
- Never pass provider keys to clients (currently largely respected; keep it that way).
- Store all provider keys in managed vault with short-lived retrieval tokens.
- Add periodic automatic key rotation and break-glass process.
- Add secret scanning in CI and pre-commit hooks.

## C) Billing (Stripe) anti-fraud
- Keep Stripe webhooks as source of truth (already mostly done).
- Add reconciliation job: Stripe ledger vs Convex budget deltas.
- Add anti-abuse controls: velocity checks, card fingerprint risk thresholds, abnormal top-up detection.

## D) Convex/data-layer security
- Add per-table row-level policy tests (ownership, tenant boundaries).
- Add a “deny by default” lint/test rule for any function touching user data.
- Build fuzz tests for IDOR-like patterns (cross-user object IDs).

## E) Prompt-injection & agent safety
- Mandatory user confirmation for high-risk side effects.
- Content provenance labels in prompts (trusted user instruction vs untrusted retrieved text).
- Add isolated planner/executor split (planner cannot execute tools directly).
- Add irreversible-action cooldowns and undo where feasible.

## F) End-to-end encryption (E2EE) options
- For truly sensitive notes/files, offer optional **client-side encryption** with user-managed keys.
- Caveat: server-side search/agent features degrade unless using encrypted-search patterns.
- Practical compromise: E2EE “vault folders” for highly sensitive content only.

---

## “No hacker can penetrate” reality check
Absolute security is impossible. The right target is:

- **Prevent most attacks by default.**
- **Detect attacker behavior quickly.**
- **Limit blast radius when one layer fails.**
- **Recover fast with revocation, rotation, and incident response playbooks.**

A mature security program is layered: secure coding + infra controls + runtime policy enforcement + monitoring + response.

---

## 30/60/90 day implementation plan

### 0–30 days (urgent)
1. Patch iframe preview hardening (sandbox + type enforcement + drop permissive schemes).
2. Add mandatory confirmation flow for high-risk tools.
3. Enforce strict Daytona egress allowlist at infra layer.
4. Add detection alerts for suspicious tool invocation patterns.

### 31–60 days
1. Replace generic Convex proxy with explicit allowlist endpoints.
2. Add systematic authz test suite for Convex functions.
3. Add token/session anomaly detection and forced re-auth flows.

### 61–90 days
1. Introduce private security policy service (for tool action authorization).
2. Add optional E2EE vault mode for sensitive user artifacts.
3. Conduct external red-team/pentest focused on agent/tool abuse and billing fraud.

---

## Final note
Your current architecture has good building blocks, but agentic systems require **runtime-enforced safety controls**, not only prompt policies. The highest ROI changes are (1) iframe/XSS hardening, (2) human-in-the-loop confirmations for risky tools, and (3) strict sandbox/network isolation.
