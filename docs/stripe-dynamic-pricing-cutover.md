# Stripe Dynamic Pricing Production Cutover

This runbook is for the narrow production migration from the legacy fixed Pro price
to the dynamic paid unit price for the current two paid customers.

It assumes:

- both live paid customers are on the legacy `$20` Pro plan
- the target dynamic unit price is `$1` per quantity
- each migrated Pro user should end up on `quantity=20`
- the effective monthly amount must stay `$20`
- the migration should happen immediately with no proration

## Preconditions

Confirm production configuration exists before touching live subscriptions:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PAID_UNIT_PRICE_ID`
- `STRIPE_TOPUP_UNIT_PRICE_ID`
- `STRIPE_PORTAL_CONFIGURATION_ID`
- `NEXT_PUBLIC_CONVEX_URL`
- `INTERNAL_API_SECRET`

The web app already creates new paid subscriptions on the dynamic unit price. The
purpose of this cutover is only to move the two existing legacy Pro subscriptions.

## 1. Deploy App And Convex First

Ship the code before the subscription swap so production can read both legacy and
dynamic subscriptions during the migration window.

If `convex/` changed:

```bash
npm run convex:push:all
```

Then deploy the web app normally.

## 2. Run A Preflight Audit

Use the audit script to identify which subscriptions are still on the legacy price
and to compare Stripe state with Convex state.

```bash
node --experimental-strip-types scripts/stripe-dynamic-pricing-audit.ts --target=prod
```

The expected pre-cutover result is:

- exactly 2 active paid subscriptions on `STRIPE_PRO_PRICE_ID`
- both show `targetQuantity=20`
- both have a valid `metadata.userId`
- both have matching Convex rows

Stop if any of these are missing:

- `targetPrice` is missing
- `userId` is missing
- Convex lookup is unavailable or points to the wrong user
- the current live amount is not `$20`

## 3. Update Each Legacy Pro Subscription In Stripe

Perform the change in the Stripe Dashboard subscription editor or with the Stripe API.

For each of the two legacy Pro subscriptions:

1. Open the subscription.
2. Edit the subscription item.
3. Replace the legacy Pro price with `STRIPE_PAID_UNIT_PRICE_ID`.
4. Set the quantity to `20`.
5. Keep the existing billing cycle anchor / renewal date.
6. Set proration to `none`.
7. Save the update.

Notes:

- Do not cancel and recreate the subscription.
- Do not reset the billing cycle anchor.
- Do not change top-up or payment-method settings.
- Subscription metadata should remain intact. `metadata.userId` must still be present.

## 4. Let Stripe Sync Convex

The Stripe webhook should upsert the subscription row automatically.

If a row does not update promptly, run the existing Stripe-to-Convex reconciliation:

```bash
npx convex run stripeSync:syncPaidSubscriptionsFromStripe --prod
```

## 5. Verify Post-Cutover State

Run the audit again:

```bash
node --experimental-strip-types scripts/stripe-dynamic-pricing-audit.ts --target=prod
```

The expected post-cutover result is:

- `legacy subscriptions to cut over: 0`
- both migrated subscriptions show `source=dynamic`
- both show `currentQuantity=20`
- both show the dynamic price id
- Convex shows:
  - `planKind=paid`
  - `planVersion=variable_v2`
  - `planAmountCents=2000`
  - `stripeQuantity=20`

Also verify manually:

- the next invoice remains `$20`
- current usage and remaining budget did not reset
- auto top-up settings remain unchanged
- billing portal quantity editing works for a migrated customer
- a brand-new paid signup lands directly on the dynamic price

## 6. Cleanup Boundary

Do not remove legacy Pro price read support in the same change. Keep the app
dual-compatible until both live customers have been verified on the dynamic price.
