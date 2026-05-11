---
title: "Troubleshooting"
description: "Common deployment issues and fixes."
---

# Troubleshooting

## Deployment

### Docker build fails

**Symptom**: `npm ci` exits with peer dependency errors.

**Fix**: Delete `node_modules` and lockfile, then rebuild:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Health check returns 500

**Symptom**: `curl /api/health` returns 500.

**Fix**: Check logs:

```bash
docker compose logs overlay-app
```

Common causes:
- `DATABASE_URL` is unreachable
- `REDIS_URL` is unreachable
- `SESSION_SECRET` is missing

### MinIO uploads fail

**Symptom**: File upload returns "Bucket not found".

**Fix**: Create the bucket:

```bash
docker compose exec overlay-storage mc mb local/overlay-files
```

## Authentication

### WorkOS callback error

**Symptom**: "Invalid redirect URI" after sign-in.

**Fix**: In WorkOS Dashboard, ensure callback URLs match exactly (including protocol and path).

### Session not persisting

**Symptom**: User is logged out on every page refresh.

**Fix**: Verify `SESSION_SECRET` is set and consistent across all app instances.

## AI

### Model returns 429

**Symptom**: "Rate limit exceeded" from AI gateway.

**Fix**: Increase `rateLimit.ai.maxRequests` in `overlay.config.json` or upgrade your AI gateway plan.

### Ollama connection refused

**Symptom**: "Connection refused" when using local Ollama.

**Fix**: Ensure Ollama is running: `ollama serve` or `docker start ollama`.

## Billing

### Stripe webhook fails

**Symptom**: Webhook endpoint returns 400.

**Fix**: Verify `STRIPE_WEBHOOK_SECRET` matches the webhook signing secret in Stripe Dashboard.

## Storage

### Presigned URL expired

**Symptom**: "Access Denied" when downloading files.

**Fix**: Increase `storage.publicUrlTtlSeconds` in `overlay.config.json`.

## Performance

### High memory usage

**Symptom**: App container uses >4 GB RAM.

**Fix**: Reduce `NEXT_PUBLIC_CONVEX_URL` polling frequency or scale to multiple containers with a load balancer.
