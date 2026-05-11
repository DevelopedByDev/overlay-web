---
title: "Keycloak"
description: "Configure Keycloak for self-hosted enterprise authentication."
---

# Keycloak

Keycloak is the recommended auth provider for fully self-hosted Overlay deployments. No external identity service required.

## Prerequisites

- Keycloak 24+ running in Docker or Kubernetes
- A dedicated Keycloak realm for Overlay

## 1. Start Keycloak

```bash
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:24.0 \
  start-dev
```

## 2. Create a Realm

1. Open `http://localhost:8080/admin`
2. Sign in with `admin` / `admin`
3. Click the realm dropdown > **Create realm**
4. Name it `overlay`

## 3. Create a Client

1. Go to **Clients > Create client**
2. **Client ID**: `overlay-app`
3. **Client authentication**: ON
4. **Authentication flow**: Standard flow
5. Add redirect URIs:
   ```text
   https://overlay.yourcompany.com/api/auth/callback
   https://overlay.yourcompany.com/api/auth/native/callback
   ```

## 4. Configure Mappers

Add these protocol mappers to the client:

| Name | Mapper Type | Claim Name | Token Claim Name |
|------|-------------|------------|------------------|
| `email` | User Property | `email` | `email` |
| `firstName` | User Property | `firstName` | `given_name` |
| `lastName` | User Property | `lastName` | `family_name` |
| `groups` | Group Membership | `groups` | `groups` |

## 5. Create Roles

Go to **Realm roles** and create:

- `overlay-admin`
- `overlay-user`

## 6. Configure Overlay

Add to `.env.local`:

```bash
AUTH_PROVIDER=keycloak
KEYCLOAK_URL=https://auth.yourcompany.com
KEYCLOAK_REALM=overlay
KEYCLOAK_CLIENT_ID=overlay-app
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

Get the client secret from **Clients > overlay-app > Credentials**.

## 7. Group → Role Mapping

In Keycloak, assign users to groups that map to Overlay roles:

```text
/overlay-admins  -> overlay-admin
/overlay-users  -> overlay-user
```

## 8. Session Management

Keycloak sessions are automatically synchronized with Overlay's session cache. To revoke a session:

1. Go to **Users > [user] > Sessions**
2. Click **Logout** or **Revoke** on the specific session

## 9. Theming (Optional)

Overlay supports Keycloak custom themes for white-labeling:

```bash
# Mount custom theme into Keycloak
docker run -v /path/to/overlay-keycloak-theme:/opt/keycloak/themes/overlay \
  quay.io/keycloak/keycloak:24.0 start-dev
```

Set the default login theme in **Realm settings > Themes > Login theme**.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Realm not found" | Verify `KEYCLOAK_REALM` matches exactly |
| "Client not found" | Check `KEYCLOAK_CLIENT_ID` and realm scope |
| "Invalid redirect URI" | Add all callback URLs to Keycloak client config |
| "CORS error" | Add `https://overlay.yourcompany.com` to Web Origins in client config |
