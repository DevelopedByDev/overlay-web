---
title: "Quickstart for IT Teams"
description: "Deploy Overlay on your own infrastructure in under 10 minutes."
---

# Quickstart for IT Teams

Deploy Overlay on your own infrastructure with Docker Compose. No external SaaS dependencies required.

## Prerequisites

- Docker Engine 24.0+ and Docker Compose
- A server with 4 CPU cores, 8 GB RAM, and 40 GB disk
- TLS certificates (or use Let's Encrypt via Caddy)

## One-Command Install

```bash
# 1. Clone the repository
git clone https://github.com/getoverlay/overlay.git
cd overlay

# 2. Copy the environment template
cp .env.example .env.local

# 3. Edit .env.local with your values (see Configuration reference)
nano .env.local

# 4. Start everything
docker compose -f docker/docker-compose.enterprise.yml up -d
```

## Verify the Deployment

```bash
# Health check
curl https://your-domain.com/api/health

# Expected response
{"status":"ok"}
```

## First-Time Admin Setup

1. Open `https://your-domain.com`
2. Sign up with your email (WorkOS AuthKit)
3. Set the `OVERLAY_ADMIN_USER_IDS` env var to your WorkOS user ID
4. Restart the app container:
   ```bash
   docker compose restart overlay-app
   ```
5. Access the admin dashboard at `/admin`

## What Gets Deployed

The Docker Compose stack includes:

| Service | Purpose | Image |
|---------|---------|-------|
| `overlay-app` | Next.js web app | Built from `docker/Dockerfile.enterprise` |
| `overlay-db` | Postgres (if migrating from Convex) | `postgres:16-alpine` |
| `overlay-cache` | Redis for rate limits + sessions | `redis:7-alpine` |
| `overlay-storage` | MinIO for file storage | `minio/minio:latest` |

## Next Steps

- [Architecture overview](/architecture) — understand the system
- [Configuration reference](/configuration) — tune every setting
- [Authentication setup](/auth/workos) — configure your identity provider
