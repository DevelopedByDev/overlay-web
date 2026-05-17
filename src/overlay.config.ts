import {
  DEFAULT_OVERLAY_BRAND_CONFIG,
  DEFAULT_OVERLAY_FEATURE_FLAGS,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_SETTINGS_SECTIONS,
  DEFAULT_OVERLAY_THEME_METADATA,
  defineOverlayAppConfig,
  resolveOverlayAppShellConfig,
} from '@overlay/app-core'

export const overlayAppConfig = defineOverlayAppConfig({
  brand: {
    ...DEFAULT_OVERLAY_BRAND_CONFIG,
  },
  navigation: [...DEFAULT_OVERLAY_NAVIGATION],
  settingsSections: [...DEFAULT_OVERLAY_SETTINGS_SECTIONS],
  featureFlags: [...DEFAULT_OVERLAY_FEATURE_FLAGS],
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
