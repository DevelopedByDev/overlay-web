# Overlay Security Hardening Summary

This document summarizes the security work completed in the repo, the controls now enforced by code and CI, and the remaining operator-owned controls that must be completed outside the repo.

## Goal

The objective of this hardening pass was to raise Overlay to a materially stronger security baseline for enterprise and retail deployment by:

- removing high-risk key exposure paths
- tightening auth and session transfer boundaries
- reducing multi-tenant storage and billing abuse risk
- adding browser, CI, and dependency hardening
- documenting cloud-side launch blockers that must be verified outside the codebase

## High-Impact Fixes Implemented

### 1. Raw provider key exposure was disabled

Previously, authenticated native clients could retrieve raw provider/server keys through a route intended for native use.

What changed:

- `/api/auth/native/provider-keys` was disabled
- server provider keys are no longer returned to clients
- direct unused provider key mappings for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, and `XAI_API_KEY` were removed from the repo
- the repo now assumes model access is mediated through Vercel AI Gateway and OpenRouter, not direct per-provider keys

Security impact:

- prevents a single user/session compromise from turning into platform-wide API key theft
- reduces provider spend abuse and secret sprawl

### 2. Stripe billing portal takeover risk was fixed

Previously, the portal route could trust a client-supplied Checkout Session too loosely.

What changed:

- the billing portal route now verifies that a Checkout Session belongs to the authenticated user before deriving a customer ID from it
- the route no longer accepts cross-user billing session reuse

Security impact:

- prevents one user from opening another customer’s billing portal if a session ID leaks

### 3. OAuth and native auth binding were hardened

Previously, OAuth state and native auth transfer were not bound tightly enough to the initiating session.

What changed:

- OAuth state is now signed and stored in an httpOnly cookie
- callback processing now validates and consumes that signed state
- native/mobile session transfer now requires PKCE-style `codeChallenge` / `codeVerifier`
- desktop/mobile auth flows now reject missing or invalid native auth linkage

Security impact:

- reduces login CSRF, account confusion, and native deep-link interception risk

### 4. Internal API auth was redesigned away from a single root secret on the wire

Previously, privileged internal API access relied on a static shared secret that could impersonate arbitrary users.

What changed:

- app-facing internal calls now use short-lived signed service auth instead of `x-internal-api-secret`
- middleware and route auth now validate signed service requests scoped by method/path/user context
- internal callers no longer serialize the root secret into request bodies

Security impact:

- removes the single shared overpowered secret from active request flows
- limits blast radius if one internal request is captured or replayed

### 5. R2 object ownership is now enforced

Previously, the app could trust stored or client-supplied `r2Key` values too much.

What changed:

- file and output object keys are validated against user-scoped prefixes
- create, update, download, and delete paths now reject foreign storage keys
- proxy and deletion flows now refuse non-owned R2 objects

Security impact:

- reduces cross-tenant object access if an attacker learns another object key

### 6. Abuse controls were added to public and expensive routes

Previously, public auth routes and expensive AI/sandbox endpoints lacked visible server-side throttling.

What changed:

- rate limiting was added to sign-in, sign-up, forgot-password, verify-email, checkout, top-ups, image generation, video generation, browser tasks, and Daytona runs
- additional throttles were added to native refresh, password reset, and email verification ticket flows

Security impact:

- reduces brute-force, spam, account enumeration, and cost-amplification abuse

## Additional Repo-Side Hardening

### Auth redirect sanitization

What changed:

- client auth pages now sanitize `redirect` parameters instead of trusting raw query strings
- only same-origin paths and the explicitly allowed Overlay desktop deep-link targets are accepted

Security impact:

- reduces open-redirect and phishing abuse through auth entry points

### Email verification flow redesign

What changed:

- raw `userId` is no longer trusted in the email verification flow
- sign-up now returns a signed verification ticket
- verify/resend flows consume that signed ticket instead of arbitrary client-supplied user IDs

Security impact:

- reduces resend abuse and targeted verification-code guessing against known user IDs

### Composio callback origin allowlisting

What changed:

- Composio callback origin selection now uses an allowlist of approved app origins
- arbitrary forwarded host/origin headers are no longer used as the callback authority

Security impact:

- reduces callback URL poisoning risk if upstream forwarding is misconfigured

### POST-only logout

What changed:

- logout is now POST-only
- the old GET logout path was removed

Security impact:

- removes a low-severity but real logout CSRF vector

## Browser Security Controls

### Content Security Policy

What changed:

- middleware now generates a per-request CSP nonce
- the app emits CSP in report-only mode by default
- CSP reports are accepted at `/api/security/csp-report`
- a toggle exists to move from report-only to enforced CSP once reports are clean

Security impact:

- establishes a safer rollout path toward strong XSS containment
- gives visibility into script and browser-policy violations before enforcement

### Additional browser headers

What changed:

- `Strict-Transport-Security` is set in production
- `Permissions-Policy` is restricted
- `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` are enforced
- HTML cache headers remain defensive to avoid stale asset/hash mismatches

Security impact:

- improves browser isolation and transport hardening

## Dependency and CI Security Controls

### Production dependency cleanup

What changed:

- `next` was upgraded to a fixed version
- production dependency vulnerabilities were reduced to zero for `npm audit --omit=dev`
- runtime/provider dependency usage was cleaned up to match actual architecture

Security impact:

- removes known production CVEs from the shipped dependency set

### Security CI gates

What changed:

- secret scanning remains in CI
- dependency review was added for pull requests
- lockfile consistency checks were added
- typecheck and production dependency audit were added as CI gates
- CodeQL was added
- Semgrep SAST was added

Security impact:

- makes security regressions and known-vulnerable dependency drift much harder to merge silently

## Security Telemetry and Auditability

What changed:

- structured security event logging was added
- CSP report ingestion was added
- rate-limit blocks now emit security events

Security impact:

- improves visibility into abuse, misconfiguration, and policy violations

## Verification Completed In Repo

During the hardening pass, the following checks were run successfully:

- `npm run typecheck`
- `npm run security:audit`
- `npm run build`
- `node --test --experimental-strip-types src/lib/security-hardening.test.ts`

`npm run lint` also passed with only pre-existing warnings unrelated to the hardening changes.

## Remaining Controls Outside the Repo

These are not solvable by code changes alone and must be completed by the operator/team:

- rotate all still-relevant secrets and revoke any previously exposed or unnecessary ones
- configure Vercel Firewall, bot protection, budgets, alerts, and log retention
- verify Cloudflare R2 IAM scope, CORS, presign TTLs, and retention behavior
- configure Daytona API key scope, egress restrictions, sandbox isolation, and audit logging
- verify Convex issuer/audience settings, prod/dev separation, and privileged auditability
- enable and verify WorkOS bot protection and exact callback/logout allowlists
- restrict Stripe production keys, rotate webhook secrets, and review portal/Radar settings
- connect security events and CSP reports to Sentry or another alerting workflow

The actionable launch-blocker checklist for those items lives in:

- [docs/enterprise-security-launch-checklist.md](/Users/divyanshlalwani/Downloads/overlay-mono/overlay-landing/docs/enterprise-security-launch-checklist.md:1)

## Current Security Posture Summary

Overlay is substantially more secure than before this hardening pass.

The repo now has:

- no client path for raw provider key retrieval
- stronger auth/session binding
- signed internal service auth instead of a shared root secret in requests
- user-bound storage ownership enforcement
- rate limits on public and expensive routes
- CSP rollout infrastructure and stronger browser headers
- clean production dependency audit results
- CI-enforced secret scanning, dependency checks, CodeQL, and Semgrep

What still determines enterprise readiness is the operator side:

- cloud configuration
- secret rotation and revocation
- alerting and incident response
- evidence collection against the enterprise launch checklist
