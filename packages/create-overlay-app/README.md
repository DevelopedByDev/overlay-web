# create-overlay-app

Scaffold an Overlay instance with interactive setup.

## Usage

```bash
# Interactive wizard
npx create-overlay-app my-org-instance

# Non-interactive on-prem
npx create-overlay-app my-org-instance --profile on-prem --non-interactive

# Docker-only (no clone)
npx create-overlay-app my-org-instance --docker-only

# Specific git tag
npx create-overlay-app my-org-instance --tag v1.2.0
```

## Profiles

| Profile | Database | Auth | AI | Storage |
|---------|----------|------|-----|---------|
| `saas` | Convex cloud | WorkOS | Vercel AI | R2 |
| `on-prem` | Postgres (Docker) | Keycloak (Docker) | Ollama (Docker) | MinIO (Docker) |
| `hybrid` | Postgres (Docker) | Keycloak (Docker) | Vercel AI | MinIO (Docker) |

## What it does

1. Detects Node, Docker, and Git
2. Clones the Overlay monorepo
3. Generates `.env.local` and `overlay.config.json`
4. Writes Docker Compose files for selected providers
5. Installs dependencies
6. Starts Docker services (on-prem/hybrid)
7. Runs health checks
8. Prints the local URL

## curl installer

```bash
curl -fsSL https://getoverlay.dev/install.sh | bash
```
