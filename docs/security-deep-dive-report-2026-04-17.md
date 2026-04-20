# Overlay Security Deep-Dive Report

Date: 2026-04-17  
Reviewer perspective: repository-driven application security review with sanitized exploit detail only

## Executive Summary

Overlay already has several meaningful protections in place around billing ownership, webhook idempotency, and Convex-side user ownership checks. The current highest-risk issues are not an obvious cross-user Convex data leak; they are auth/session invalidation semantics, overly-central internal trust boundaries, and powerful model-driven execution surfaces.

The sharpest verified finding is a WorkOS session revocation gap: if WorkOS access-token refresh fails, the app currently keeps trusting the locally signed `overlay_session` cookie until its cookie expiry window. In practice, that means upstream session revocation may not become authoritative quickly enough for privileged app routes.

The second major class of risk is architectural: many privileged flows still collapse onto a single long-lived `INTERNAL_API_SECRET`. The current implementation is better than directly sending that root secret on every internal request, but compromise of that secret anywhere in server infrastructure would still let an attacker mint valid internal service-auth tokens for arbitrary users.

The third major class is AI-agent risk. Retrieved notebook and memory content is injected into model context without explicit "treat as inert untrusted data" framing, while Act mode can invoke destructive or expensive tools such as Daytona sandbox execution, browser automation, note mutation, image/video generation, and automation drafting. The code contains useful defense-in-depth checks, but the current safety posture still assumes the model or retrieved content will behave well too often.

No honest security review can promise that "no malicious hacker, however skilled" can ever penetrate the system. The realistic goal is to materially reduce compromise likelihood, limit blast radius, make revocation authoritative, and ensure a single mistake does not become a platform-wide failure. The recommendations in this report are aimed at that standard.

### Top 5 Risks By Severity and Blast Radius

1. **High**: Revoked or invalid upstream WorkOS sessions can remain usable because refresh failure falls back to the existing cookie-backed session.
2. **High**: `INTERNAL_API_SECRET` remains a platform-wide trust root; if leaked, it enables forged internal service auth for arbitrary users.
3. **High**: Prompt injection from stored knowledge can influence model behavior without a strong untrusted-data boundary.
4. **High**: Act-mode tool execution exposes sandbox and browser capabilities with only shallow app-side filtering relative to the power of those tools.
5. **Medium/High**: In-memory rate limiting is weak for horizontally scaled or serverless deployments and can be bypassed for auth spraying and cost amplification.

## Methodology and Scope

This review is based on repository inspection, targeted local validation, and dependency auditing. I reviewed:

- auth/session code paths
- WorkOS token verification and refresh behavior
- internal service-auth flows
- Stripe checkout, verification, and webhook handling
- Convex mutations, queries, and authorization patterns
- prompt-retrieval, tool policy, and agent execution surfaces
- middleware and browser hardening headers
- provider key handling and secret broker paths
- supply-chain exposure from shipped production dependencies

Focused local validation performed:

- `node --test --experimental-strip-types src/lib/security-hardening.test.ts src/lib/sentry-sanitize.test.ts`
  - Result: passed
- `npm audit --omit=dev --audit-level=high`
  - Result: `2 vulnerabilities (1 moderate, 1 critical)`
  - `follow-redirects <=1.15.11`
  - `protobufjs <7.5.5`

Important limitation: this review did **not** inspect live Vercel, WorkOS, Stripe, Convex, Daytona, Cloudflare R2, or dashboard-side configuration directly. Any statement about deployed CSP mode, Daytona egress policy, secret rotation, bot protection, or KMS posture is therefore a code-informed deployment assumption unless otherwise marked.

## Findings Matrix

| Severity | Status | Finding | Area | Exploitability | Business Impact | Confidence | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| High | Verified | WorkOS session revocation gap allows stale signed session reuse after refresh failure | Auth / session | Moderate | Unauthorized continued account access after upstream revocation or failure | High | Immediate |
| High | Architectural | Static `INTERNAL_API_SECRET` remains a single platform-wide trust root | Internal service auth | High if secret leaks | Arbitrary internal-user impersonation and privileged route abuse | High | Immediate |
| High | Verified | Auto-retrieved knowledge is injected without a strong untrusted-data boundary | Prompt injection / agent safety | Moderate | Model steering, exfiltration attempts, destructive tool misuse | Medium-High | Immediate |
| High | Verified | Act mode exposes powerful tools with only shallow pre-execution controls | Sandbox / browser / agents | Moderate | Data exfiltration, destructive actions, cost abuse, environment misuse | High | Immediate |
| Medium/High | Verified | In-memory rate limiting is weak for serverless or multi-instance deployments | Abuse controls | High | Auth spraying, billing abuse, AI cost amplification | High | This sprint |
| Medium | Verified | Middleware treats cookie shape as sufficient for perimeter access checks | Auth boundary / middleware | Moderate | Future authz footgun and weaker perimeter guarantees | Medium-High | This sprint |
| Medium | Verified | Production dependency audit reports `protobufjs` and `follow-redirects` exposure | Supply chain | Moderate | RCE/header leakage exposure through shipped dependency graph | High | This sprint |
| Medium | Config-dependent | CSP may still be report-only if deployment matches `.env.example` | Browser hardening | Low-Moderate | Reduced XSS containment if prod enforcement is off | Medium | This sprint |

## Existing Mitigations and Non-Findings

The following protections are already doing real work and should not be regressed:

- **Server-anchored Stripe checkout creation**: subscription checkout derives `userId` from the authenticated session rather than taking it directly from the client (`src/app/api/checkout/route.ts:14-27`, `src/app/api/checkout/route.ts:61-95`).
- **Stripe webhook replay deduplication**: webhook handlers record event IDs and skip duplicate or stale replayed events (`convex/http.ts:27-45`, `convex/subscriptions.ts:738-777`).
- **Stripe top-up amount uses Stripe's authoritative paid total** rather than trusting metadata (`convex/http.ts:169-210`).
- **Stripe customer cross-link protection**: webhook-side upsert refuses to bind one Stripe customer ID to multiple Overlay users (`convex/subscriptions.ts:387-400`).
- **Top-up dedupe by payment intent / checkout session**: repeated verification should update an existing top-up row rather than insert duplicates (`convex/subscriptions.ts:597-658`, `convex/subscriptions.ts:661-720`).
- **Convex ownership checks are generally present**: user-scoped memory operations validate caller identity and object ownership before mutation (`convex/memories.ts:6-15`, `convex/memories.ts:156-205`).

I did **not** find a clean, current, high-confidence "read another user's Convex data by changing `userId`" exploit in the main user-data flows I reviewed. That should shape prioritization: the risk is presently more about auth/session trust, internal signing authority, and agent execution than about a trivial multi-tenant read bug.

## Detailed Findings

### 1. High: WorkOS Session Revocation Gap

**What I verified**

- Session cookies live for up to 30 days (`src/lib/workos-auth.ts:30-33`).
- `getSession()` attempts to refresh access tokens when needed, but if refresh fails it returns the existing session instead of clearing it (`src/lib/workos-auth.ts:714-727`).
- `resolveAuthenticatedAppUser()` trusts any non-null `getSession()` result immediately and returns `{ userId, accessToken }` without independently re-verifying the token first (`src/lib/app-api-auth.ts:10-17`).

**Attacker path**

An attacker who steals a valid `overlay_session` cookie, or a user whose upstream WorkOS session has been revoked, can continue hitting app routes that trust `getSession()` as long as the cookie itself remains valid and refresh continues to fail or cannot occur.

**Affected trust boundary**

The boundary between locally signed/encrypted app session state and upstream WorkOS session authority.

**Business impact**

- Delayed session revocation
- Longer persistence for stolen-cookie abuse
- Reduced effectiveness of incident response, admin disablement, or token revocation

**Why current defenses are insufficient**

The cookie is cryptographically protected against tampering, but revocation is an authorization problem, not a tamper problem. A signed stale session is still stale.

**Recommended remediation**

- On refresh failure, clear the session and force re-authentication instead of returning the stale session.
- Make revocation authoritative on privileged routes by either:
  - re-verifying access-token claims on every privileged request, or
  - moving to a server-side session record with revocation/version checks
- Add explicit forced logout on refresh failure, upstream invalidation, or account disable.

### 2. High: Static `INTERNAL_API_SECRET` Remains A Single Trust Root

**What I verified**

- Service auth uses `INTERNAL_API_SECRET` as the HMAC signing key (`src/lib/service-auth.ts:16-21`, `src/lib/service-auth.ts:53-65`).
- Tokens include `aud`, `sub`, `method`, `path`, `iat`, and `exp`, and default TTL is 60 seconds (`src/lib/service-auth.ts:1-14`, `src/lib/service-auth.ts:97-121`).
- Verification checks signature, expiry, method, path, and optional user ID (`src/lib/service-auth.ts:123-171`).

**Attacker path**

If the secret leaks from any server environment, logs, preview environment, or misconfigured infrastructure, an attacker can mint valid internal auth tokens and impersonate arbitrary users on internal routes that trust service auth.

**Affected trust boundary**

Internal server-to-server trust and privileged route access.

**Business impact**

- Full internal API impersonation
- Privileged data mutation under arbitrary user IDs
- Broad blast radius from one leaked root secret

**Why current defenses are insufficient**

The current HMAC token is materially better than shipping the raw root secret on every request, but the architecture still depends on one long-lived symmetric secret. There is no asymmetric signing boundary, no `jti`, and no replay store.

**Recommended remediation**

- Replace HMAC-with-root-secret service auth with short-lived KMS-signed service JWTs.
- Include `sub`, `aud`, `method`, `path`, `exp`, `iat`, and `jti`.
- Add replay protection for `jti`.
- Rotate keys aggressively and separate prod/staging/preview signing material.

### 3. High: Prompt Injection Risk In Auto-Retrieved Knowledge

**What I verified**

- Auto-retrieved notebook and memory content is injected into a model-visible block labeled `AUTO_RETRIEVED_KNOWLEDGE` (`src/lib/ask-knowledge-context.ts:49-72`).
- The framing tells the model that some items may be irrelevant and to ignore what does not apply, but it does **not** explicitly state that instructions inside retrieved content are untrusted and must never override system/tool policy (`src/lib/ask-knowledge-context.ts:50-55`).
- Act-mode system text encourages use of search and web tools but likewise does not clearly establish retrieved content as inert untrusted data (`src/lib/knowledge-agent-instructions.ts:17-23`).

**Attacker path**

A malicious note, indexed document, or other stored knowledge source can contain natural-language instructions intended to steer the model into leaking information, taking destructive actions, or misusing tools.

**Affected trust boundary**

The boundary between user content / retrieved knowledge and model instruction authority.

**Business impact**

- Tool misuse
- Confidential-data exfiltration attempts
- Destructive note or automation changes
- Higher risk from open-source visibility because attacker-authored content can target known tool surfaces

**Why current defenses are insufficient**

Retrieval ranking and tool policy help, but they are not the same as a clear instruction hierarchy. Without an explicit "retrieved content is data, not instructions" boundary, prompt injection remains materially easier.

**Recommended remediation**

- Wrap retrieved content in an explicit untrusted-data envelope.
- Add system rules stating that instructions found inside files, notes, memories, or web content are never authoritative.
- Separate retrieval-only contexts from action-capable runs.
- Add tool-specific approvals or policy gates for destructive, exfiltrating, or third-party actions.

### 4. High: Model-Driven Tool Execution Risk In Act Mode

**What I verified**

- Act mode exposes a broad tool set including note CRUD, automation drafting, image/video generation, browser sessions, and Daytona sandbox execution (`src/lib/tools/policy.ts:20-37`).
- The Daytona route itself states that LLM-composed commands are structurally untrusted and that the primary defense is Daytona-side isolation, not perfect app-side sanitization (`src/app/api/app/daytona/run/route.ts:45-50`).
- App-side command validation mostly checks command length, control characters, and obvious metadata/internal host patterns (`src/app/api/app/daytona/run/route.ts:51-83`, `src/app/api/app/daytona/run/route.ts:222-231`).
- Browser task execution similarly validates only sanitized task length/input shape before handing the task to Browser Use (`src/app/api/app/browser-task/route.ts:60-66`, `src/app/api/app/browser-task/route.ts:118-128`).

**Attacker path**

Prompt injection or a compromised user prompt can convince the model to invoke expensive or dangerous tools, especially where the tool contract itself is powerful and the app-side validator only blocks obviously bad cases.

**Affected trust boundary**

The boundary between model intent and privileged execution.

**Business impact**

- Arbitrary or destructive sandbox activity within the allowed execution environment
- Cost amplification via browser/sandbox/image/video tasks
- Third-party action abuse if integrations or automation tooling are expanded
- More serious consequences if Daytona egress or filesystem constraints are weaker than assumed

**Why current defenses are insufficient**

The current design relies heavily on the runtime sandbox behaving perfectly and on the model not being steered into dangerous-but-technically-valid actions. That is not enough for an attacker model.

**Recommended remediation**

- Treat Daytona and browser tasks as privileged execution domains.
- Enforce egress allowlists, metadata/IP blocking, filesystem scope limits, execution TTLs, and artifact scanning.
- Add policy-based allowlists for commands, destinations, and output types.
- Require extra approval for high-risk tool categories and third-party effects.

### 5. Medium/High: In-Memory Rate Limiting Is Not Durable

**What I verified**

- Rate limiting uses a process-local `Map` (`src/lib/rate-limit.ts:17`).
- IP extraction trusts `x-forwarded-for` / `x-real-ip` at face value (`src/lib/rate-limit.ts:33-37`).
- Auth, checkout, browser, and Daytona routes rely on this helper (`src/app/api/checkout/route.ts:24-27`, `src/app/api/app/browser-task/route.ts:48-52`, `src/app/api/app/daytona/run/route.ts:249-252`).

**Attacker path**

An attacker can spread requests across instances or exploit serverless scaling behavior to bypass what looks like a global limit. In less controlled edge setups, header trust can also weaken IP-based enforcement.

**Affected trust boundary**

Public abuse controls and cost-protection boundary.

**Business impact**

- More effective credential spraying or auth abuse
- Faster billing/cost amplification
- Weaker protection for expensive AI, browser, and sandbox endpoints

**Why current defenses are insufficient**

Process-local memory is not a durable shared coordination mechanism in a distributed deployment.

**Recommended remediation**

- Move to a durable shared rate limiter.
- Key by verified user/session plus IP and device-risk signals.
- Add separate buckets for auth, billing, browser, sandbox, and generation endpoints.

### 6. Medium: Middleware Only Checks Cookie Shape, Not Cookie Validity

**What I verified**

- Protected routes include `/account`, `/api/entitlements`, `/api/portal`, `/api/convex`, `/app`, and `/api/app` (`src/middleware.ts:10`).
- For protected routes, middleware only checks that a session cookie exists and has plausible `parts.length` and payload length (`src/middleware.ts:178-201`).
- It does not verify signature or decrypt the cookie at middleware time.

**Attacker path**

Today this is mostly a perimeter weakness because deeper route auth often catches invalid sessions later. The real risk is that a future route under a protected prefix may assume middleware already established a valid authenticated user when it did not.

**Affected trust boundary**

Edge/middleware perimeter.

**Business impact**

- Increased chance of future authz regressions
- Larger blast radius from one route that forgets to re-check auth deeper in the stack

**Why current defenses are insufficient**

Cookie presence/shape is not identity proof. It is only a cheap prefilter.

**Recommended remediation**

- Either verify the cookie properly at middleware time or narrow middleware's role to routing only and avoid treating it as an auth boundary.
- Add regression tests ensuring protected prefixes cannot rely on cookie shape alone.

### 7. Medium: Production Dependency Audit Reports Known Vulnerabilities

**What I verified**

`npm audit --omit=dev --audit-level=high` reported on 2026-04-17:

- `protobufjs <7.5.5` — critical
- `follow-redirects <=1.15.11` — moderate

Relevant shipped dependencies include `@daytonaio/sdk`, `posthog-js`, and `axios` (`package.json:54`, `package.json:89`, `package.json:101`).

**Attacker path**

The exact exploitability depends on runtime usage paths, but supply-chain vulnerabilities reduce confidence in the safety of the shipped production dependency graph and should not be normalized away.

**Affected trust boundary**

Application runtime and dependency graph.

**Business impact**

- Increased RCE or header leakage exposure through third-party code
- Higher incident response burden if one of these packages becomes reachable through a used code path

**Why current defenses are insufficient**

The codebase cannot out-defend a vulnerable dependency indefinitely; packages still need upgrading or pinning.

**Recommended remediation**

- Prioritize upgrading or pinning to eliminate the `protobufjs` finding first.
- Upgrade or override `follow-redirects` as well.
- Re-run `npm audit --omit=dev --audit-level=high` in CI and fail builds until the production tree is clean.

### 8. Medium / Config-Dependent: CSP May Still Be Report-Only

**What I verified**

- Middleware emits either enforced CSP or report-only CSP based on `SECURITY_CSP_ENFORCE` (`src/middleware.ts:75-79`).
- `.env.example` sets `SECURITY_CSP_ENFORCE=false` (`.env.example:37-39`).

**Attacker path**

This is not a proof of a current production vulnerability. It becomes a real risk only if deployed environments still match the example and never flipped enforcement on after rollout.

**Affected trust boundary**

Browser-side XSS containment.

**Business impact**

- If production CSP is still report-only, browser-side exploitation impact is higher than it needs to be

**Why current defenses are insufficient**

Report-only mode is visibility, not enforcement.

**Recommended remediation**

- Verify actual deployed values in Vercel.
- If staging and prod reports are clean, move production to enforced CSP.
- Keep CSP report monitoring in place after enforcement.

## Hardening Roadmap

### Immediate

- Fix the WorkOS session revocation gap: do not keep trusting stale sessions when refresh fails.
- Make revocation authoritative for privileged routes.
- Treat Act-mode tools, Daytona, and browser execution as privileged operations.
- Validate Daytona dashboard egress policy against the assumptions in code comments.
- Patch or pin the critical `protobufjs` dependency path.

### This Sprint

- Replace in-memory rate limiting with a durable distributed implementation.
- Tighten middleware so protected-route gating does not rely on cookie shape.
- Add explicit prompt-injection framing for retrieved notes, documents, and memories.
- Add tool-specific approval or policy gates for destructive, exfiltrating, or third-party actions.
- Verify CSP enforcement status and move production out of report-only mode if ready.
- Add stronger anomaly detection for billing, top-ups, promo abuse, and replay attempts.

### Architectural / Strategic

- Replace `INTERNAL_API_SECRET` trust with short-lived KMS-signed service JWTs.
- Add replay protection with `jti`.
- Add step-up auth for sensitive billing, integrations, exports, and high-risk tool actions.
- Add risk scoring, anomaly alerts, and tenant-level kill switches for tools like Daytona, browser automation, and integrations.
- Consider a split between low-trust and high-trust agent modes.
- Offer an optional high-sensitivity data-protection tier with stronger encryption guarantees.

## Recommended Technical Changes

### Auth / Session

- Stop accepting a stale session when WorkOS refresh fails.
- Either re-verify access tokens on privileged routes or move to a server-side session record with revocation/version checks.
- Add forced logout on refresh failure, revoked session, or account disable.

### Internal Service Auth

- Replace shared-secret HMAC trust with short-lived KMS-signed service JWTs.
- Include `sub`, `aud`, `method`, `path`, `exp`, `iat`, and `jti`.
- Store replay state for `jti`.
- Rotate signing keys aggressively across environments.

### Prompt Injection / Agent Safety

- Wrap all retrieved knowledge and web/document content in an explicit untrusted-data envelope.
- Add system instructions that content-origin instructions are non-authoritative.
- Separate retrieval-only runs from action-capable runs.
- Add tool-specific approval gates for destructive, exfiltrating, or third-party actions.

### Sandbox / Browser Execution

- Treat Daytona and browser tasks as privileged execution.
- Enforce network egress allowlists, metadata/IP blocking, filesystem scope limits, execution TTLs, and artifact scanning.
- Add policy-based allowlists for commands, destinations, and output types.

### Rate Limiting / Abuse Controls

- Move to a durable shared rate limiter.
- Key by verified user/session plus IP/device risk signals.
- Apply separate controls for auth, billing, browser, sandbox, and generation endpoints.

### Billing

- Keep Stripe as the monetary source of truth.
- Prefer webhook-driven state as the authoritative billing source wherever possible.
- Add anomaly detection for top-up repetition, subscription flips, promo abuse, and replay attempts.
- Require step-up auth for sensitive billing changes when risk is elevated.

### Secrets / API Keys

- Keep provider keys server-only behind a minimal broker.
- Prefer Vault/KMS-backed retrieval and rotation.
- Reduce long-term production reliance on raw environment fallback.
- Add outbound allowlists and per-provider usage telemetry.

### User Data

- Add stronger audit logging for cross-boundary reads/writes.
- Re-review file/output presign scopes, retention, and deletion paths.
- Document an optional encryption tier for high-sensitivity content.

## Public APIs / Interfaces To Call Out

If the recommended hardening is implemented, the main interface changes will likely be:

- a new internal service-auth token format replacing the current shared-secret HMAC design
- an auth/session model with authoritative revocation semantics
- a more explicit tool-execution policy contract for action-capable routes
- optional sensitivity/encryption metadata for notes, files, memories, or knowledge sources

## Strategic Feature Recommendations

- Step-up auth for billing, integrations, exports, and high-risk tool actions.
- Risk scoring and anomaly alerts for agent-originated destructive behavior.
- Tenant-level kill switches for Daytona, browser automation, and third-party integrations.
- Separate high-trust and low-trust agent modes.
- Optional end-to-end encryption for the most sensitive user content.

### Note on End-to-End Encryption

End-to-end encryption is powerful, but it is not a free win for an agent product. It improves resistance to server compromise, but it also reduces server-side search, retrieval, ranking, and automated agent utility unless the product architecture changes substantially. If implemented, it should be positioned as an optional high-sensitivity mode, not a default band-aid.

## Open-Source Exposure and Close-Sourcing Guidance

Open source makes exploit development easier because attackers can study exact trust boundaries, recovery logic, and tool contracts. That matters here, especially for agent systems. But closing the repo would only slow attackers down; it would not solve the underlying security problems.

The right framing is:

- keep public-facing product code open if that aligns with company goals
- move the most security-sensitive control planes to private services or private packages if desired
- treat close-sourcing as a secondary friction layer, not a primary defense

If any parts are moved private first, prioritize:

- service-auth minting and verification
- provider-key broker / vault abstraction
- agent tool-policy engine
- sandbox execution broker
- billing reconciliation and fraud rules

Even then, real protection still comes from secret isolation, hardened infra, authoritative revocation, durable abuse controls, and explicit trust boundaries.

## Validation Plan

After remediation, validate at minimum:

1. Reproduce revoked-session behavior and confirm immediate logout after the fix.
2. Test replay and forgery resistance of the replacement internal service-auth tokens.
3. Run distributed auth and billing abuse simulations against the durable rate limiter.
4. Inject malicious instructions into stored knowledge and confirm the model treats them as inert data.
5. Verify Daytona and browser execution cannot reach metadata services, RFC1918 space, localhost, or unapproved domains.
6. Re-run `npm audit --omit=dev --audit-level=high` and confirm the production dependency tree is clean.
7. Re-test Stripe idempotency, replay handling, cross-account ownership checks, and top-up dedupe.

## Assumptions and Defaults

- Scope is full-system from a code-review perspective: app code plus deployment assumptions where code clearly depends on dashboard or environment configuration.
- Exploit detail is intentionally sanitized and non-weaponized.
- Evidence is limited to repository review, local tests, and local dependency audit.
- Findings are explicitly labeled as `Verified`, `Architectural`, or `Config-dependent` to avoid mixing code truth with deployment assumptions.

