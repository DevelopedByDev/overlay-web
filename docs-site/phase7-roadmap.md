---
title: "Phase 7 Roadmap"
description: "Auto-generated docs, OpenAPI specs, Storybook, and TypeDoc — planned for Phase 7."
---

# Phase 7 Roadmap: Auto-Generated Documentation

Phase 7 will close the documentation loop by generating API specs, component docs, and type docs automatically from source code.

## OpenAPI Spec

### Goal

Generate `openapi.json` from route-level Zod schemas so the API reference is always in sync with the implementation.

### Plan

1. Add Zod request/response schemas to every `src/app/api/**/*.ts` route
2. Install `zod-to-openapi` and `@asteasolutions/zod-to-openapi`
3. Create `scripts/generate-openapi.ts` that walks API routes and builds the spec
4. Run in CI on every merge to `main`
5. Publish to `/docs/api/openapi.json`

### Example

```typescript
// src/app/api/app/bootstrap/route.ts
import { z } from 'zod'
import { extendZodWithOpenApi } from 'zod-to-openapi'

extendZodWithOpenApi(z)

const BootstrapResponse = z.object({
  user: z.object({ id: z.string(), email: z.string() }),
  entitlements: z.object({ tier: z.string(), creditsUsed: z.number() }),
}).openapi('BootstrapResponse')
```

## Storybook

### Goal

Interactive component documentation for `packages/overlay-ui`.

### Plan

1. Install `@storybook/react` and `@storybook/nextjs` in `packages/overlay-ui`
2. Create `.storybook/main.ts` and `.storybook/preview.ts`
3. Write stories for all exported components
4. Build and publish to `/docs/ui`

### Example

```typescript
// packages/overlay-ui/src/Button/Button.stories.tsx
import { Button } from './Button'

export default { component: Button }
export const Primary = { args: { variant: 'primary', children: 'Click me' } }
```

## TypeDoc

### Goal

Generated API docs for `packages/overlay-core` interfaces.

### Plan

1. Install `typedoc` in `packages/overlay-core`
2. Configure `typedoc.json` with entry points for all domain interfaces
3. Generate on every build
4. Publish to `/docs/core`

### Example

```bash
cd packages/overlay-core
npx typedoc --out ../../docs-site/core src/index.ts
```

## CI Integration

```yaml
# .github/workflows/docs.yml
name: Generate Docs
on:
  push:
    branches: [main]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run docs:generate
      - run: npm run docs:build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs-site/dist
```

## Contributing Docs

Add a "Contributing" section for enterprises that want to fork and patch:

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm run typecheck && npm run test`
4. Open a PR against `main`
5. CI will verify type safety and run the verification script

## Success Criteria

- [ ] `openapi.json` is generated automatically from Zod schemas
- [ ] Storybook builds and renders all UI components
- [ ] TypeDoc generates interface docs for `overlay-core`
- [ ] All three are published to the docs site on every release
- [ ] Contributing guide exists for fork-and-patch workflows
