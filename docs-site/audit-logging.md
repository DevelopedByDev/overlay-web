---
title: "Audit Logging"
description: "Audit event schema, retention, and export."
---

# Audit Logging

Overlay captures structured audit events for compliance and security review.

## Event Schema

```typescript
interface AuditEvent {
  id: string
  timestamp: string // ISO 8601
  type: 'auth.signin' | 'auth.signout' | 'admin.impersonate' |
        'billing.checkout' | 'billing.topup' | 'ai.generate' |
        'file.upload' | 'file.delete' | 'user.update'
  actor: {
    userId: string
    email: string
    ip: string
    userAgent: string
  }
  resource: {
    type: string
    id: string
  }
  outcome: 'success' | 'failure' | 'denied'
  details: Record<string, unknown>
}
```

## Retention

| Environment | Retention | Storage |
|-------------|-----------|---------|
| SaaS | 90 days | Convex + S3 archive |
| Self-hosted | Configurable | Postgres + local disk |

Configure retention in `overlay.config.json`:

```json
{
  "audit": {
    "retentionDays": 365,
    "exportFormat": "jsonl"
  }
}
```

## Export

```bash
# Export last 30 days
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://overlay.yourcompany.com/api/admin/audit?since=30d&format=csv"
```

## SIEM Integration

Forward audit events to your SIEM:

```json
{
  "audit": {
    "forwarders": [
      {
        "type": "webhook",
        "url": "https://siem.company.com/ingest/overlay"
      }
    ]
  }
}
```
