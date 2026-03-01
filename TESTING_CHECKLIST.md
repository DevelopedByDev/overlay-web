# Stripe Subscription Testing Checklist

## Prerequisites

### 1. Start Stripe CLI for Webhook Forwarding

Open a terminal and run:

```bash
# Login to Stripe CLI (if not already)
stripe login

# Forward webhooks to local Next.js app
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Copy the webhook signing secret** from the CLI output (starts with `whsec_`) and update `.env.local`:

```bash
# In overlay-landing/.env.local
STRIPE_WEBHOOK_SECRET=whsec_YOUR_CLI_SECRET_HERE
```

### 2. Start the Landing Page Dev Server

```bash
cd overlay-landing
npm run dev
```

### 3. Start the Desktop App

```bash
cd .. # back to overlay root
npm run dev
```

### 4. Sign into Desktop App
- Make sure you're signed in to the desktop app with WorkOS
- Note your userId (visible in console logs)

---

## Test Scenarios

### Test 1: New Pro Subscription ✅

**Steps:**
1. Click "Upgrade to Pro" in desktop app AccountSettings
2. Verify URL opens: `https://localhost:3000/pricing?userId=YOUR_USER_ID`
3. Click "Subscribe to Pro"
4. Use test card: `4242 4242 4242 4242` (any expiry, any CVC)
5. Complete checkout

**Verify:**
- [ ] Redirected to `/account?success=true&open_app=true`
- [ ] Success message shows with "Open in App" button
- [ ] Deep link auto-triggers after 1.5s (or click button)
- [ ] Desktop app console shows: `[Subscription] Deep link triggered - refreshing entitlements`
- [ ] Desktop app console shows: `[SubscriptionService] Synced from Convex (tier: pro)`
- [ ] AccountSettings in desktop app shows "Pro" tier
- [ ] Stripe CLI shows webhook received: `checkout.session.completed`

**Stripe CLI Output:**
```
2024-XX-XX ... --> checkout.session.completed [evt_...]
2024-XX-XX ... <-- [200] POST http://localhost:3000/api/webhooks/stripe
```

---

### Test 2: New Max Subscription

**Steps:**
1. Open `http://localhost:3000/pricing?userId=YOUR_USER_ID`
2. Click "Subscribe to Max"
3. Use test card: `4242 4242 4242 4242`
4. Complete checkout

**Verify:**
- [ ] Redirected to success page
- [ ] Desktop app shows "Max" tier after deep link
- [ ] Credits total shows $90

---

### Test 3: Upgrade from Pro to Max

**Steps:**
1. Start with Pro subscription (from Test 1)
2. Click "Manage Subscription" in desktop app
3. In Stripe billing portal, upgrade to Max

**Verify:**
- [ ] Stripe CLI shows `customer.subscription.updated`
- [ ] Desktop app tier updates to Max (within 60s polling or manual refresh)

---

### Test 4: Downgrade from Max to Pro

**Steps:**
1. Start with Max subscription
2. In Stripe billing portal, downgrade to Pro

**Verify:**
- [ ] Stripe CLI shows `customer.subscription.updated`
- [ ] Desktop app tier updates to Pro

---

### Test 5: Cancel Subscription

**Steps:**
1. With active subscription, click "Manage Subscription"
2. Cancel subscription in Stripe portal

**Verify:**
- [ ] Stripe CLI shows `customer.subscription.deleted` (or updated with status=canceled)
- [ ] Desktop app shows subscription ending at period end
- [ ] After period ends, tier reverts to "free"

---

### Test 6: Payment Failure (Declined Card)

**Steps:**
1. Open pricing page
2. Click "Subscribe to Pro"
3. Use declined card: `4000 0000 0000 0002`
4. Attempt checkout

**Verify:**
- [ ] Checkout shows card declined error
- [ ] No subscription created
- [ ] User stays on free tier

---

### Test 7: Payment Requires Authentication (3D Secure)

**Steps:**
1. Open pricing page
2. Click "Subscribe to Pro"
3. Use 3DS card: `4000 0025 0000 3155`
4. Complete 3D Secure challenge

**Verify:**
- [ ] 3DS modal appears
- [ ] After authenticating, subscription succeeds
- [ ] Desktop app shows Pro tier

---

### Test 8: Insufficient Funds

**Steps:**
1. Open pricing page
2. Use card: `4000 0000 0000 9995`

**Verify:**
- [ ] Checkout fails with "insufficient funds" message

---

### Test 9: Invoice Payment Succeeded (Renewal)

**Steps:**
1. In Stripe Dashboard (test mode), find subscription
2. Click "Create upcoming invoice" → "Pay invoice"

**Verify:**
- [ ] Stripe CLI shows `invoice.payment_succeeded`
- [ ] Token usage resets for new billing period

---

### Test 10: Invoice Payment Failed

**Steps:**
1. Update subscription payment method to failing card
2. Trigger invoice in Stripe Dashboard

**Verify:**
- [ ] Stripe CLI shows `invoice.payment_failed`
- [ ] Subscription status changes to `past_due`

---

## Stripe Test Cards Reference

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0341` | Attaches but fails on charge |

All test cards use:
- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any valid ZIP (e.g., 12345)

---

## Debugging

### Check Convex Data

Open Convex dashboard:
```
https://dashboard.convex.dev/d/different-caiman-77
```

Check tables:
- `subscriptions` - subscription records
- `tokenUsage` - billing period usage
- `dailyUsage` - daily action counts
- `refillCredits` - purchased refill credits

### Desktop App Logs

Watch for these log prefixes:
- `[SubscriptionService]` - entitlement sync
- `[DeepLink]` - deep link handling
- `[Convex]` - Convex API calls

### Landing Page Logs

Check browser console and terminal for:
- API route logs
- Webhook processing logs

---

## After Testing: Restore Production Keys

```bash
# In overlay-landing/.env.local, swap back:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... (production webhook secret)
```
