---
title: "WorkOS"
description: "Configure WorkOS AuthKit for Overlay authentication."
---

# WorkOS Authentication

WorkOS is the default auth provider for Overlay. It supports passwordless email, OAuth (Google, Microsoft), and enterprise SSO via the same API.

## Prerequisites

- [WorkOS account](https://workos.com)
- A WorkOS Organization for your domain

## 1. Create a WorkOS Project

1. Go to the [WorkOS Dashboard](https://dashboard.workos.com)
2. Create a new project (or use an existing one)
3. Note the **Client ID** and **API Key**

## 2. Configure Callback URLs

In the WorkOS Dashboard, add these redirect URIs:

```text
https://overlay.yourcompany.com/api/auth/callback
https://overlay.yourcompany.com/api/auth/native/callback
```

## 3. Environment Variables

Add to `.env.local`:

```bash
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
```

Also set these in Convex:

```bash
npx convex env set WORKOS_API_KEY sk_...
npx convex env set WORKOS_CLIENT_ID client_...
```

## 4. Test Authentication

1. Start the app: `npm run dev`
2. Visit `http://localhost:3000`
3. Click "Sign In" — you should see the WorkOS AuthKit modal
4. Complete sign-in and verify you land on the dashboard

## 5. Admin Users

Set `OVERLAY_ADMIN_USER_IDS` to grant admin access:

```bash
# Get your WorkOS user ID from the dashboard or database
OVERLAY_ADMIN_USER_IDS=user_abc123,user_xyz789
```

## 6. Vault-Backed Provider Keys (Optional)

If you use WorkOS Vault for AI provider credentials:

```bash
VAULT_ANTHROPIC_KEY_ID=api-key-anthropic
VAULT_OPENAI_KEY_ID=api-key-openai
VAULT_GOOGLE_KEY_ID=api-key-google
VAULT_GROQ_KEY_ID=api-key-groq
VAULT_XAI_KEY_ID=api-key-xai
VAULT_OPENROUTER_KEY_ID=api-key-openrouter
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Invalid redirect URI" | Check callback URLs in WorkOS Dashboard match exactly |
| "Organization not found" | Ensure your email domain is linked to a WorkOS Organization |
| Session not persisting | Verify `SESSION_SECRET` is set and consistent across restarts |
