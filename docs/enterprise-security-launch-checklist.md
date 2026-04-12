# Enterprise Security Launch Checklist

This checklist is the launch gate for enterprise-facing releases. Treat every unchecked item as a blocker.

## Repo-Enforced Controls

- [x] Raw provider key export disabled for clients.
- [x] Stripe portal sessions bound to the authenticated user.
- [x] Native session transfer requires PKCE validation.
- [x] Internal API calls use short-lived signed service auth instead of a static root secret over the wire.
- [x] R2 object keys are validated against the authenticated owner.
- [x] High-cost and auth routes have server-side rate limiting.
- [x] CSP report ingestion is available at `/api/security/csp-report`.
- [x] CI blocks on secret scanning, dependency review, production dependency audit, CodeQL, and Semgrep.

## Before Every Enterprise Launch

### Secret Rotation

- [ ] Rotate `INTERNAL_API_SECRET`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `COMPOSIO_API_KEY`, `BROWSER_USE_API_KEY`, Daytona credentials, WorkOS keys, Stripe secrets, and any other provider key that was previously reachable from client flows.
- [ ] Confirm old credentials are revoked, not just superseded.
- [ ] Capture rotation date, owner, and evidence in the release notes or an internal security tracker.

### Vercel

- [ ] Enable Vercel Firewall protections appropriate for public traffic: managed rules, bot protection, and route-level rate limiting for auth, billing, AI, browser, and sandbox endpoints.
- [ ] Configure AI Gateway budgets, alerts, and per-provider usage review. Verify budget alerts route to an on-call channel.
- [ ] Confirm runtime logs and deployment logs are retained long enough for incident response and are accessible to the production responders.
- [ ] Verify preview deployments do not expose production secrets or production datasets.

### Cloudflare R2

- [ ] Bucket access remains private. Only presigned URLs should reach end users.
- [ ] R2 API tokens are scoped to the minimum bucket and permissions required.
- [ ] Bucket CORS allows only the expected app origins and HTTP methods.
- [ ] Presigned URL TTL stays short and is documented. Current implementation assumes short-lived bearer-style access.
- [ ] Lifecycle, retention, and delete behavior are documented for customer data.

### Daytona

- [ ] Daytona API keys are scoped to the minimum org/project privileges needed by this app.
- [ ] Sandbox egress is default-deny or allowlisted to the minimum destinations required for the product.
- [ ] User sandboxes never inherit cloud admin credentials, Stripe secrets, AI provider keys, or long-lived tokens.
- [ ] Execution logs, destination metadata, and artifact lineage are retained for abuse review.
- [ ] Incident response includes a procedure to revoke or quarantine active sandboxes quickly.

### Convex

- [ ] Production and development deployments are separate and correctly wired through env vars.
- [ ] Auth issuer and audience settings match the actual WorkOS tokens in production.
- [ ] No admin or deployment tokens are exposed to clients.
- [ ] After editing `convex/` auth or authorization logic, push both deployments with `npm run convex:push:all`.
- [ ] Audit logs or equivalent traces exist for privileged server mutations.

### WorkOS

- [ ] Hosted AuthKit bot protection is enabled for public sign-in and sign-up surfaces.
- [ ] Allowed callback and logout URLs exactly match the production and approved preview origins.
- [ ] PKCE and state validation failures are visible in logs with enough detail for investigation.
- [ ] WorkOS API keys are rotated and scoped per environment.

### Stripe

- [ ] Production Stripe keys are restricted to the minimum resources required.
- [ ] Webhook signing secrets are rotated and verified in production.
- [ ] Portal configuration is reviewed so customers can only access intended billing functions.
- [ ] Radar or equivalent anti-fraud settings are enabled for public payment flows.
- [ ] Billing support has a documented procedure for customer account takeover and payment abuse.

### Security Telemetry

- [ ] Sentry or another alerting sink receives `security_event:*` messages from the app.
- [ ] CSP reports are reviewed in staging before enabling `SECURITY_CSP_ENFORCE=true` in production.
- [ ] Rate-limit spikes, repeated auth failures, and abnormal sandbox usage page the responsible team.
- [ ] Incident responders know where to find runtime logs, deploy logs, auth logs, Stripe events, and R2 audit evidence.

## Release Evidence

For each production launch, capture:

- Release date and commit SHA.
- Security approver.
- Secret rotation or explicit confirmation that no rotation was required.
- Links to Vercel, Cloudflare, Daytona, Convex, WorkOS, Stripe, and alerting screenshots or exports showing the controls above.
