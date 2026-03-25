Open-Source Security Audit Report

Scope





Audited the current repository (overlay-landing) in read-only mode.



Focus areas requested: API keys, stored files/data/knowledge, tools/computer features, auth/session boundaries, and environment variables.



Method: static code review + secret-pattern scanning + config/docs review.

Executive Risk Summary





Critical blockers before open-sourcing





Weak token validation across Convex public functions allows unverified bearer strings/JWT-shaped tokens.



Provider secret retrieval path returns raw env secrets from Convex with weak auth (keys:getAPIKey).



Multi-tenant data authorization gaps (IDOR style) on several Convex query/mutation paths that trust caller-supplied userId/resource ids.



High-risk controls missing/weak





Fallback hardcoded session secrets.



Native refresh endpoint trusts client-supplied user profile object.



Unauthenticated operational endpoint (/computer/log) in Convex HTTP router.



Open-source hygiene issues





Internal deployment URLs, local machine paths, and operational metadata present in tracked docs/state files.

flowchart LR
  browserClient[BrowserClient] --> nextApi[NextApiRoutes]
  nextApi --> convexPublic[ConvexPublicFunctions]
  convexPublic --> sensitiveData[UserDataAndSecrets]
  convexPublic --> keyEndpoint[keysGetAPIKey]
  keyEndpoint --> envSecrets[ProviderEnvSecrets]

Findings (Prioritized)

Critical





Token validation is non-cryptographic across Convex auth checks





Evidence: [convex/lib/auth.ts](convex/lib/auth.ts), [convex/usage.ts](convex/usage.ts), [convex/users.ts](convex/users.ts), [convex/computers.ts](convex/computers.ts), [convex/keys.ts](convex/keys.ts)



Current validateAccessToken() only checks length and optional JWT exp parsing; no signature/JWKS/issuer/audience/sub binding.



Impact: attacker can satisfy checks with crafted long token strings or unsigned JWT-like values.



Raw provider secret exfil path via Convex action





Evidence: [convex/keys.ts](convex/keys.ts)



getAPIKey returns values from env (OPENAI_API_KEY, ANTHROPIC_API_KEY, COMPOSIO_API_KEY, etc.) gated only by weak token validator.



Impact: catastrophic secret leakage if invoked by unauthorized caller.



Authorization gaps on user-owned datasets (IDOR risk)





Evidence: [convex/memories.ts](convex/memories.ts), [convex/conversations.ts](convex/conversations.ts), [convex/files.ts](convex/files.ts)



Many operations trust caller-provided userId and/or IDs without ownership check against cryptographically verified identity.



Impact: cross-user read/write/delete risk.

High





Entitlements read can be unauthenticated / weakly authenticated





Evidence: [convex/usage.ts](convex/usage.ts), [src/app/api/entitlements/route.ts](src/app/api/entitlements/route.ts)



getEntitlements accepts optional accessToken; route reads query userId and forwards directly.



Impact: authenticated or unauthenticated information disclosure of other users’ usage/tier.



Session secret fallback defaults are unsafe for production





Evidence: [src/lib/workos-auth.ts](src/lib/workos-auth.ts), [src/app/api/app/auth/extension-token/route.ts](src/app/api/app/auth/extension-token/route.ts)



Uses fallback literals (overlay-dev-session-secret-change-me, overlay-dev-secret) and fallback to WORKOS_API_KEY for signing.



Impact: token/cookie forgery under misconfiguration.



Native refresh endpoint trusts client-provided user profile





Evidence: [src/app/api/auth/native/refresh/route.ts](src/app/api/auth/native/refresh/route.ts), [src/lib/workos-auth.ts](src/lib/workos-auth.ts)



refreshSessionFromRefreshToken returns refreshed session with user object passed from request body, not provider response.



Impact: session identity confusion/injection risk.



Unauthenticated Convex HTTP log endpoint





Evidence: [convex/http.ts](convex/http.ts)



/computer/log accepts computerId + message without secret/HMAC validation.



Impact: log poisoning/spam, operational confusion, potential abuse.

Medium





Redirect target from OAuth callback state is not path-allowlisted





Evidence: [src/app/api/auth/callback/route.ts](src/app/api/auth/callback/route.ts)



Decoded state is used as redirectTo and concatenated to base URL.



Impact: open redirect/path abuse if crafted state passes through.



Internal API base URL trusts forwarded headers





Evidence: [src/lib/url.ts](src/lib/url.ts)



Uses x-forwarded-host/x-forwarded-proto to build internal fetch base.



Impact: SSRF-style host confusion in misconfigured proxy scenarios.



Desktop session transfer design exposes high-value token material





Evidence: [src/app/api/auth/desktop-link/route.ts](src/app/api/auth/desktop-link/route.ts), [convex/sessionTransfer.ts](convex/sessionTransfer.ts), [convex/schema.ts](convex/schema.ts)



Transfer token in URL query; consumed endpoint returns accessToken + refreshToken payload.



Impact: token leakage via logs/history/referrers if not tightly constrained.



Verbose logging of operational and user-linked metadata





Evidence: [src/app/api/app/conversations/ask/route.ts](src/app/api/app/conversations/ask/route.ts), [src/app/api/app/conversations/act/route.ts](src/app/api/app/conversations/act/route.ts), [convex/computers.ts](convex/computers.ts), [src/app/api/auth/sso/[provider]/route.ts](src/app/api/auth/sso/[provider]/route.ts)



Includes query previews, user IDs, internal model/tool details, stack traces.



Impact: sensitive telemetry leakage in shared logging systems.

Low / Open-source hygiene





Tracked local Cursor state reveals local absolute paths/transcript metadata





Evidence: [.cursor/hooks/state/continual-learning-index.json](.cursor/hooks/state/continual-learning-index.json), [.gitignore](.gitignore)



.gitignore excludes one file but not this index file.



Docs include real infrastructure identifiers and operational topology





Evidence: [ENV_SETUP.md](ENV_SETUP.md), [slack-manifest.yaml](slack-manifest.yaml), [README.md](README.md)



Exposes production/dev Convex URLs and app webhook endpoints; useful recon info.



No repository SECURITY.md / disclosure policy found





Evidence: no matching file in repo scan.

Priority Remediation Roadmap

Phase 0 (Blockers Before Public Repo)





Remove or hard-disable secret-returning Convex action behavior.





Update [convex/keys.ts](convex/keys.ts): do not return raw provider keys to untrusted callers.



Replace weak token checks with real JWT verification and identity binding.





Centralize verifier in [convex/lib/auth.ts](convex/lib/auth.ts) with JWKS + iss + aud + exp + sub.



Enforce sub === userId where userId is supplied.



Lock down data ownership checks for public functions.





Start with [convex/conversations.ts](convex/conversations.ts), [convex/files.ts](convex/files.ts), [convex/memories.ts](convex/memories.ts), [convex/usage.ts](convex/usage.ts), [convex/computers.ts](convex/computers.ts).



Fix entitlements IDOR and unauthenticated reads.





In [src/app/api/entitlements/route.ts](src/app/api/entitlements/route.ts), derive userId from session only.



In [convex/usage.ts](convex/usage.ts), require verified token for public entitlements query.

Phase 1 (High-Risk Hardening)





Remove secret fallbacks and fail closed in production.





[src/lib/workos-auth.ts](src/lib/workos-auth.ts), [src/app/api/app/auth/extension-token/route.ts](src/app/api/app/auth/extension-token/route.ts)



Correct refresh identity source.





[src/lib/workos-auth.ts](src/lib/workos-auth.ts), [src/app/api/auth/native/refresh/route.ts](src/app/api/auth/native/refresh/route.ts)



Add auth/HMAC to /computer/log.





[convex/http.ts](convex/http.ts)



Add explicit redirect allowlist for callback state.





[src/app/api/auth/callback/route.ts](src/app/api/auth/callback/route.ts)

Phase 2 (Defense in Depth)





Restrict internal base URL resolution to configured canonical host.





[src/lib/url.ts](src/lib/url.ts)



Reduce sensitive logging and redact IDs/query previews/tokens.





[src/app/api/app/conversations/ask/route.ts](src/app/api/app/conversations/ask/route.ts), [src/app/api/app/conversations/act/route.ts](src/app/api/app/conversations/act/route.ts), [convex/computers.ts](convex/computers.ts)



Review desktop token transfer flow; prefer one-time POST handoff and avoid returning refresh token to browser contexts.





[src/app/api/auth/desktop-link/route.ts](src/app/api/auth/desktop-link/route.ts), [convex/sessionTransfer.ts](convex/sessionTransfer.ts)

Phase 3 (Open-Source Readiness)





Clean tracked local metadata and strengthen ignore rules.





[.gitignore](.gitignore), [.cursor/hooks/state/continual-learning-index.json](.cursor/hooks/state/continual-learning-index.json)



Replace real infra values in docs with placeholders.





[ENV_SETUP.md](ENV_SETUP.md), [slack-manifest.yaml](slack-manifest.yaml)



Add security process docs.





Create SECURITY.md (reporting, supported versions, secret handling policy, threat model summary).



Add CI checks.





Secret scanning (gitleaks/GitHub secret scanning), dependency audit, and policy checks for NEXT_PUBLIC_* misuse.

Actionable Implementation Checklist





Remove public secret-returning behavior in keys:getAPIKey.



Introduce a single verified auth function and migrate all Convex public handlers to it.



Add ownership assertions for all user-scoped resources before read/write/delete.



Make /api/entitlements session-derived only; eliminate query userId trust.



Require SESSION_SECRET in production startup; delete weak defaults.



Use WorkOS refresh response identity, not client body identity.



Authenticate /computer/log similarly to /computer/ready.



Allowlist callback redirects to safe internal paths only.



Sanitize logging (no token/user query previews).



Remove .cursor local state from tracked files and docs with real infra endpoints.



Add SECURITY.md + automated secret scanning in CI.

Residual Risk Notes





This audit is static and code-based; runtime, deployment IAM, and historical git history secret leaks still need dedicated checks before public release.



Given current critical findings, do not publish the repo publicly until Phase 0 is complete and verified.

