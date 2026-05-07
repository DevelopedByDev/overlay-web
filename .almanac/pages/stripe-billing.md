---
title: Stripe Billing
topics: [stack, systems, billing, backend, operations]
files:
  - src/lib/stripe.ts
  - src/lib/stripe-billing.ts
  - src/lib/billing-pricing.ts
  - src/lib/billing-runtime.ts
  - convex/subscriptions.ts
  - convex/stripeSync.ts
  - docs/stripe-dynamic-pricing-cutover.md
---

# Stripe Billing

Overlay uses Stripe for subscriptions, dynamic paid plan billing, top-ups, auto top-up preferences, and portal access. Billing state and entitlement enforcement are centralized behind backend routes and Convex modules; clients should not calculate paid entitlements locally.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/stripe.ts` - initializes the Stripe server client.
- `src/lib/stripe-billing.ts` - resolves price IDs, creates top-ups, handles auto top-up idempotency, and writes billing state back to Convex.
- `src/lib/billing-pricing.ts` - defines plan and top-up pricing conversions.
- `src/lib/billing-runtime.ts` - checks budget and constructs insufficient-credit responses.
- `convex/subscriptions.ts`, `convex/usage.ts`, `convex/stripe.ts`, and `convex/stripeSync.ts` - persist subscription, usage, and Stripe synchronization state.
- `docs/backend-overview.md` - states that the live Stripe webhook handler is `convex/http.ts`, not the deprecated Next route.

## Configuration

Environment variables visible in `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAID_UNIT_PRICE_ID`, `STRIPE_TOPUP_UNIT_PRICE_ID`, `STRIPE_PORTAL_CONFIGURATION_ID`, and the matching `DEV_STRIPE_*` variants.

## Future Capture

### Operational constraints

<!-- stub: capture webhook setup, migration steps, and dynamic pricing cutover details. -->

### Known gotchas

<!-- stub: capture Stripe test/live mode, idempotency, and webhook replay surprises. -->
