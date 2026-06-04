# Customer Deployment Template

This example shows the recommended on-prem customization shape for schools and universities:

- Keep Overlay core pinned to an upstream version.
- Keep customer extensions in local source.
- Register pages, settings, tools, and API handlers through the extension SDK.
- Deploy the web app with customer config and local extensions bundled at build time.

## Structure

```txt
examples/customer-deployment/
  overlay.config.ts
  extensions/student-success/
  docker-compose.yml
  helm/values.yaml
```

The sample extension adds a Student Success page at `/app/x/student-success`, plus authenticated extension API handlers under `/api/v1/extensions/student-success/*`.

## Update Model

Enterprise IT keeps the extension code local, then periodically bumps the Overlay version:

```bash
npm ci
npm run extension-sdk:test
npm run extension-sdk:typecheck
npm run typecheck
```

If the extension only uses SDK contracts and shell primitives, product updates should usually be dependency bumps instead of merge-heavy source edits.
