// @enterprise-future — not wired to production
// Example UI panel plugin entrypoint (client-side)

import { definePanel } from '@overlay/plugin-sdk/client'

export default definePanel({
  id: 'example.stats',
  location: 'sidebar-bottom',
  icon: 'BarChart3',
  label: 'Stats',
  componentPath: './StatsPanel.tsx',
})
