---
title: Overlay Design System
topics: [systems, frontend, design]
files:
  - docs/DESIGN_PHILOSOPHY.md
  - packages/overlay-app-core/src/theme.ts
  - src/app/globals.css
  - src/lib/landingThemeConstants.ts
  - src/lib/landingPageStyles.ts
  - overlay-chrome/packages/overlay-chat-ui/src/styles/overlay-theme.css
---

# Overlay Design System

Overlay's UI language is documented in `docs/DESIGN_PHILOSOPHY.md` and partially encoded as shared theme tokens in `@overlay/app-core`. The visible design vocabulary emphasizes off-white backgrounds, near-black text, muted gray hierarchy, glass surfaces, rounded pill controls, and serif display typography for landing-page expression.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `docs/DESIGN_PHILOSOPHY.md` - documents the landing-page philosophy, palette, typography, spacing, glass surfaces, and overlay window rules.
- `packages/overlay-app-core/src/theme.ts` - defines shared color themes, spacing, radii, and font-size constants.
- `src/app/globals.css` - applies global web CSS.
- `src/lib/landingThemeConstants.ts` and `src/lib/landingPageStyles.ts` - hold landing-page styling constants and helpers.
- `overlay-chrome/packages/overlay-chat-ui/src/styles/overlay-theme.css` - carries theme styling for the shared Chrome chat UI package.

## Future Capture

### Design intent

<!-- stub: capture why new UI patterns are accepted or rejected. -->

### Visual constraints

<!-- stub: capture recurring layout, typography, icon, and component rules. -->
