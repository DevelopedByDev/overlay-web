# @overlay/core

Overlay core business logic interfaces and provider contracts.

## Interfaces

| Domain | Interface | SaaS Default | Enterprise Swap |
|--------|-----------|-------------|-----------------|
| Database | `IDatabase` | Convex | PostgreSQL, SQLite |
| Auth | `IAuth` | WorkOS | SAML, OIDC, LDAP |
| Storage | `IStorage` | Cloudflare R2 | MinIO, S3 |
| AI | `IAI` | Vercel AI Gateway | Ollama, vLLM |
| Billing | `IBilling` | Stripe | Disabled |
| Queue | `IQueue` | Convex Actions | BullMQ |
| Search | `ISearch` | Convex Full-Text | Meilisearch |
| Audit | `IAudit` | Convex Log | Postgres |

## Config

```ts
import { parseOverlayConfig } from '@overlay/core'

const config = parseOverlayConfig({
  version: '1.0',
  providers: {
    database: 'postgres',
    auth: 'oidc',
    storage: 'minio',
    aiGateway: 'ollama',
    billing: 'disabled',
    queue: 'bullmq',
    search: 'meilisearch',
  },
})
```

> **Status:** `@enterprise-future` — not wired to production. Safe to modify.
