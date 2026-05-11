---
title: "SAML 2.0 / OIDC"
description: "Configure enterprise SSO with Okta, Azure AD, or any SAML/OIDC provider."
---

# SAML 2.0 / OIDC

Overlay supports SAML 2.0 and OIDC for enterprise single sign-on. Works with any identity provider.

## Supported Providers

- Okta
- Microsoft Entra ID (Azure AD)
- Google Workspace
- OneLogin
- Any SAML 2.0 or OIDC-compliant IdP

## Okta Setup

### 1. Create an App Integration

1. In Okta, go to **Applications > Applications**
2. Click **Create App Integration**
3. Choose **SAML 2.0**

### 2. Configure SAML

**Single Sign-On URL**:
```text
https://overlay.yourcompany.com/api/auth/callback
```

**Audience URI (SP Entity ID)**:
```text
overlay-yourcompany
```

**Name ID format**: `EmailAddress`

### 3. Attribute Statements

| Name | Value | Name Format |
|------|-------|-------------|
| `email` | `user.email` | `URI Reference` |
| `firstName` | `user.firstName` | `URI Reference` |
| `lastName` | `user.lastName` | `URI Reference` |
| `groups` | `groups` | `URI Reference` |

### 4. Download Metadata

Download the **Identity Provider metadata** XML and save it as `saml-metadata.xml`.

### 5. Configure Overlay

Add to `.env.local`:

```bash
AUTH_PROVIDER=saml
SAML_METADATA_URL=https://your-okta-domain.okta.com/app/.../sso/saml/metadata
SAML_ENTITY_ID=overlay-yourcompany
SAML_CALLBACK_URL=https://overlay.yourcompany.com/api/auth/callback
```

## Azure AD (Microsoft Entra ID) Setup

### 1. Register an Application

1. Go to [Azure Portal > Microsoft Entra ID > App registrations](https://portal.azure.com)
2. Click **New registration**
3. Set redirect URI:
   ```text
   https://overlay.yourcompany.com/api/auth/callback
   ```

### 2. Configure OIDC

Add to `.env.local`:

```bash
AUTH_PROVIDER=oidc
OIDC_ISSUER=https://login.microsoftonline.com/your-tenant-id/v2.0
OIDC_CLIENT_ID=your-app-client-id
OIDC_CLIENT_SECRET=your-app-client-secret
OIDC_REDIRECT_URI=https://overlay.yourcompany.com/api/auth/callback
```

### 3. Group Mapping

Map Azure AD groups to Overlay roles:

```bash
ADMIN_GROUPS="Overlay-Admins,IT-Admins"
USER_GROUPS="Overlay-Users"
```

## JIT Provisioning

Overlay supports Just-In-Time provisioning. First-time SSO users are automatically created with default entitlements:

```bash
# .env.local
JIT_PROVISIONING=true
JIT_DEFAULT_TIER=free
```

## Session Management

Overlay sessions are stored in Redis (self-hosted) or Convex (SaaS). Admins can view and revoke active sessions from the admin dashboard.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "SAML assertion not valid" | Check clock sync between IdP and SP |
| "User not found" | Enable JIT provisioning or pre-create users |
| "Group mapping failed" | Verify attribute names match exactly |
