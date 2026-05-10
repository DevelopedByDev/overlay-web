// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader — client-side entrypoints (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { UIPanelDefinition, ThemeDefinition } from './capabilities'

export function definePanel(def: UIPanelDefinition): UIPanelDefinition {
  return def
}

export function defineTheme(def: ThemeDefinition): ThemeDefinition {
  return def
}
