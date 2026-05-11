---
title: "Docker"
description: "Deploy Overlay with Docker Compose."
---

# Docker Deployment

The recommended self-hosted path. A single `docker compose up` gets you a fully working Overlay instance.

## Files

- `docker/Dockerfile.enterprise` — production Next.js image
- `docker/docker-compose.enterprise.yml` — full stack definition

## Dockerfile

```dockerfile
# @enterprise-future — not wired to production
# Production Dockerfile for enterprise deployments.

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["npm", "start"]
```

## Docker Compose

Create `docker/docker-compose.enterprise.yml`:

```yaml
version: "3.8"

services:
  overlay-app:
    build:
      context: ..
      dockerfile: docker/Dockerfile.enterprise
    ports:
      - "3000:3000"
    env_file:
      - ../.env.local
    depends_on:
      - overlay-db
      - overlay-cache
      - overlay-storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  overlay-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: overlay
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: overlay
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  overlay-cache:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  overlay-storage:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## Environment File

Create `.env.local`:

```bash
# App
NEXT_PUBLIC_APP_URL=https://overlay.yourcompany.com
NODE_ENV=production

# Secrets (generate with: openssl rand -hex 32)
SESSION_SECRET=replace-me
INTERNAL_API_SECRET=replace-me
SESSION_TRANSFER_KEY=replace-me
SESSION_COOKIE_ENCRYPTION_KEY=replace-me
PROVIDER_KEYS_SECRET=replace-me
HOOKS_TOKEN_SALT=replace-me

# Database
DATABASE_URL=postgresql://overlay:replace-me@overlay-db:5432/overlay

# Cache
REDIS_URL=redis://overlay-cache:6379

# Storage
MINIO_ACCESS_KEY=replace-me
MINIO_SECRET_KEY=replace-me
S3_ENDPOINT=http://overlay-storage:9000
S3_BUCKET_NAME=overlay-files
S3_REGION=us-east-1

# Auth
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
OVERLAY_ADMIN_USER_IDS=user_...

# AI
AI_GATEWAY_API_KEY=vgw_...
OPENROUTER_API_KEY=sk-or-...

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Deploy

```bash
cd docker
docker compose -f docker-compose.enterprise.yml up -d --build
```

## Reverse Proxy (Caddy)

Create `Caddyfile`:

```caddy
overlay.yourcompany.com {
  reverse_proxy localhost:3000
  tls your-email@company.com
}
```

Run Caddy:

```bash
caddy run --config Caddyfile
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `build` fails on `npm ci` | Delete `node_modules` and rebuild |
| Health check fails | Check `DATABASE_URL` and `REDIS_URL` connectivity |
| MinIO uploads fail | Ensure bucket exists: `mc mb local/overlay-files` |
