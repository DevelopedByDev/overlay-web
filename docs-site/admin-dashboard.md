---
title: "Admin Dashboard"
description: "Features and setup for the Overlay admin dashboard."
---

# Admin Dashboard

The admin dashboard provides visibility and control over your Overlay instance.

## Access

Navigate to `/admin` after signing in with an admin account.

Set admin users:

```bash
OVERLAY_ADMIN_USER_IDS=user_abc,user_xyz
```

## Features

### User Management

- View all registered users
- Search by email or name
- Impersonate users for support
- Suspend or delete accounts

### Audit Log

- Filter by event type, user, date range
- Export to CSV
- Real-time streaming via WebSocket

### Settings

- Feature flags
- Model availability
- Rate limit thresholds
- Billing configuration

### System Health

- API route latency
- AI gateway status
- Storage connectivity
- Database metrics

## API

Admin endpoints (require `withAdmin` middleware):

```text
GET  /api/admin/users
GET  /api/admin/audit
GET  /api/admin/settings
POST /api/admin/impersonate
```
