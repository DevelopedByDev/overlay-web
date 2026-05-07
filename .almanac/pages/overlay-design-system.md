---
title: Overlay Design System
topics: [systems, frontend, design]
files:
  - docs/DESIGN_PHILOSOPHY.md
  - packages/overlay-app-core/src/theme.ts
  - src/app/globals.css
  - src/lib/landingThemeConstants.ts
  - src/lib/landingPageStyles.ts
  - src/components/PageNavbar.tsx
  - src/app/auth/sign-in/page.tsx
  - src/app/account/page.tsx
  - overlay-chrome/packages/overlay-chat-ui/src/styles/overlay-theme.css
---

# Overlay Design System

Overlay's UI language is documented in `docs/DESIGN_PHILOSOPHY.md` and partially encoded as shared theme tokens in [[shared-app-core]]. The visible design vocabulary emphasizes off-white backgrounds, near-black text, muted gray hierarchy, glass surfaces, rounded pill controls, and serif display typography for landing-page expression.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `docs/DESIGN_PHILOSOPHY.md` - documents the landing-page philosophy, palette, typography, spacing, glass surfaces, and overlay window rules.
- `packages/overlay-app-core/src/theme.ts` - defines shared color themes, spacing, radii, and font-size constants.
- `src/app/globals.css` - applies global web CSS.
- `src/lib/landingThemeConstants.ts` and `src/lib/landingPageStyles.ts` - hold landing-page styling constants and helpers.
- `src/components/PageNavbar.tsx` - provides the shared marketing navbar used by landing-adjacent web pages.
- `src/app/auth/sign-in/page.tsx` and `src/app/account/page.tsx` - use landing theme context, landing page style helpers, and shared marketing chrome instead of standalone page chrome.
- `overlay-chrome/packages/overlay-chat-ui/src/styles/overlay-theme.css` - carries theme styling for the shared Chrome chat UI package.

## Future Capture

### Design intent

<!-- stub: capture why new UI patterns are accepted or rejected. -->

### Visual constraints

Sign-in and account pages are marketing-adjacent surfaces, so they should use `PageNavbar`, `LandingThemeProvider`, and `landingPageStyles` rather than a separate navbar or isolated account styling. The sign-in route keeps the shared navbar visible on mobile and desktop and offsets its main content below the fixed navbar.

<!-- stub: capture recurring layout, typography, icon, and component rules. -->
