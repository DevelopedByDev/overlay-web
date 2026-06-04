import {
  DEFAULT_OVERLAY_BRAND_CONFIG,
  DEFAULT_OVERLAY_FEATURE_FLAGS,
  DEFAULT_OVERLAY_FEATURE_MODULES,
  DEFAULT_OVERLAY_INTEGRATION_REGISTRY,
  DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_POLICY_GATES,
  DEFAULT_OVERLAY_SETTINGS_PANELS,
  DEFAULT_OVERLAY_SETTINGS_SECTIONS,
  DEFAULT_OVERLAY_SIDEBAR_ACTIONS,
  DEFAULT_OVERLAY_THEME_METADATA,
  DEFAULT_OVERLAY_TOOL_REGISTRY,
  defineOverlayAppConfig,
} from '@overlay/app-core'
import {
  defineOverlayExtensions,
  extendOverlayAppConfig,
} from '@overlay/extension-sdk'

const customerExtensions = defineOverlayExtensions([])

const baseConfig = defineOverlayAppConfig({
  brand: {
    ...DEFAULT_OVERLAY_BRAND_CONFIG,
    name: 'Enterprise AI Workspace',
    shortName: 'Overlay',
    organizationName: 'Example Enterprise',
    supportEmail: 'it@example.com',
  },
  navigation: [...DEFAULT_OVERLAY_NAVIGATION],
  settingsSections: [...DEFAULT_OVERLAY_SETTINGS_SECTIONS],
  featureFlags: [...DEFAULT_OVERLAY_FEATURE_FLAGS],
  featureModules: [...DEFAULT_OVERLAY_FEATURE_MODULES],
  sidebarActions: [...DEFAULT_OVERLAY_SIDEBAR_ACTIONS],
  settingsPanels: [...DEFAULT_OVERLAY_SETTINGS_PANELS],
  tools: [...DEFAULT_OVERLAY_TOOL_REGISTRY],
  integrations: [...DEFAULT_OVERLAY_INTEGRATION_REGISTRY],
  modelProviders: [...DEFAULT_OVERLAY_MODEL_PROVIDER_REGISTRY],
  policyGates: [...DEFAULT_OVERLAY_POLICY_GATES],
  theme: { ...DEFAULT_OVERLAY_THEME_METADATA },
})

export const overlayAppConfig = extendOverlayAppConfig(baseConfig, customerExtensions)

export default overlayAppConfig
