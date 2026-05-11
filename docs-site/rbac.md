---
title: "Role-Based Access Control"
description: "Configure roles and permissions in Overlay."
---

# Role-Based Access Control

Overlay uses a simple role model: **user** and **admin**. Enterprise deployments can extend this with custom roles.

## Default Roles

| Role | Permissions |
|------|-------------|
| `user` | Standard app access, own data only |
| `admin` | Full admin dashboard access, can impersonate users |

## Extending Roles

Create custom roles in `overlay.config.json`:

```json
{
  "rbac": {
    "roles": {
      "user": {
        "permissions": ["conversations:read", "conversations:write", "files:read", "files:write"]
      },
      "premium": {
        "inherits": "user",
        "permissions": ["models:premium", "browser:use", "daytona:use"]
      },
      "admin": {
        "permissions": ["*"]
      }
    }
  }
}
```

## Content Filtering

Block or allow models and tools per role:

```json
{
  "rbac": {
    "contentFilter": {
      "user": {
        "allowedModels": ["openrouter/free", "gemini-3-flash-preview"],
        "blockedTools": ["browser-use", "daytona"]
      },
      "premium": {
        "allowedModels": ["*"],
        "blockedTools": []
      }
    }
  }
}
```

## Group Mapping

Map external identity provider groups to Overlay roles:

```bash
# Keycloak / SAML
ADMIN_GROUPS="Overlay-Admins"
PREMIUM_GROUPS="Overlay-Premium"
USER_GROUPS="Overlay-Users"
```
