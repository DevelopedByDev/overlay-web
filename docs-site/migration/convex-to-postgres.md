---
title: "Convex to Postgres"
description: "Planned migration guide from Convex to Postgres."
---

# Convex to Postgres Migration

> **Status**: Planned for a future release. This document outlines the migration strategy.

## Motivation

Postgres is the standard choice for self-hosted enterprise deployments. This migration will:

- Remove the Convex dependency for fully air-gapped environments
- Enable standard SQL tooling (migrations, backups, ORMs)
- Support existing enterprise Postgres infrastructure

## Migration Strategy

### Phase 1: Schema Mapping

Map Convex schemas to Postgres tables:

| Convex Module | Postgres Table | Notes |
|---------------|----------------|-------|
| `convex/users.ts` | `users` | Add `created_at`, `updated_at` |
| `convex/conversations.ts` | `conversations` | JSONB for messages |
| `convex/files.ts` | `files` | Keep metadata, move blobs to S3 |
| `convex/memories.ts` | `memories` | Vector type for embeddings |
| `convex/subscriptions.ts` | `subscriptions` | Stripe state mirror |

### Phase 2: Query Rewrite

- Convert Convex queries to Drizzle ORM / Prisma
- Replace real-time subscriptions with WebSocket events
- Replace Convex actions with standard API routes

### Phase 3: Data Export

```bash
# Export Convex data
npx convex export --format jsonl

# Import to Postgres
pgloader convex-export.jsonl postgresql://...
```

### Phase 4: Gradual Cutover

1. Run Postgres in read-replica mode alongside Convex
2. Migrate writes incrementally
3. Switch read traffic to Postgres
4. Decommission Convex

## Timeline

This migration is not scheduled. Follow the project roadmap for updates.
