import {
  DEFAULT_OVERLAY_BRAND_CONFIG,
  DEFAULT_OVERLAY_FEATURE_FLAGS,
  DEFAULT_OVERLAY_FEATURE_MODULES,
  DEFAULT_OVERLAY_INTEGRATION_REGISTRY,
  DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_POLICY_GATES,
  DEFAULT_OVERLAY_SETTINGS_SECTIONS,
  DEFAULT_OVERLAY_SETTINGS_PANELS,
  DEFAULT_OVERLAY_SIDEBAR_ACTIONS,
  DEFAULT_OVERLAY_THEME_METADATA,
  DEFAULT_OVERLAY_TOOL_REGISTRY,
  defineOverlayAppConfig,
  resolveOverlayAppShellConfig,
} from '@overlay/app-core'

export const overlayAppConfig = defineOverlayAppConfig({
  brand: {
    ...DEFAULT_OVERLAY_BRAND_CONFIG,
    name: 'Starter Stack',
    shortName: 'Starter Stack',
    logoAlt: 'Starter Stack',
    organizationName: 'Starter Stack',
    homeHref: '/app/projects',
  },
  // Project-first sidebar: only Projects is a top-level destination. Chat,
  // Files, Extensions, and Automations are accessed via the project hub
  // (each project's own internal tabs) rather than as global views. The
  // default registry still defines them so deep links keep working; this
  // app instance just doesn't surface them in the primary nav.
  navigation: DEFAULT_OVERLAY_NAVIGATION.filter((item) => item.id === 'projects'),
  settingsSections: [...DEFAULT_OVERLAY_SETTINGS_SECTIONS],
  featureFlags: [...DEFAULT_OVERLAY_FEATURE_FLAGS],
  featureModules: [...DEFAULT_OVERLAY_FEATURE_MODULES],
  sidebarActions: [...DEFAULT_OVERLAY_SIDEBAR_ACTIONS],
  settingsPanels: [...DEFAULT_OVERLAY_SETTINGS_PANELS],
  tools: [...DEFAULT_OVERLAY_TOOL_REGISTRY],
  integrations: [...DEFAULT_OVERLAY_INTEGRATION_REGISTRY],
  modelProviders: [...DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY],
  policyGates: [...DEFAULT_OVERLAY_POLICY_GATES],
  theme: {
    ...DEFAULT_OVERLAY_THEME_METADATA,
  },
  modelPolicy: {
    filterChatModels: (models) => models,
    filterImageModels: (models) => models,
    filterVideoModels: (models) => models,
  },
})

export const overlayAppShell = resolveOverlayAppShellConfig(overlayAppConfig)

export default overlayAppConfig
