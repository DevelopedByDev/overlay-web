import type {
  AppDestinationConfig,
  AppFeatureFlags,
  OverlayAppConfig,
  OverlayAppShellRegistry,
  OverlayBrandConfig,
  OverlayFeatureFlag,
  OverlayFeatureFlagId,
  OverlayNavigationItem,
  OverlaySettingsSection,
  OverlayThemeMetadata,
  ThemePresetId,
} from './contracts'
import { LIGHT_PRESETS, DARK_PRESETS, PRESET_CSS_VAR_KEYS, PRESETS } from './theme'

export const DEFAULT_OVERLAY_BRAND_CONFIG: OverlayBrandConfig = {
  name: 'overlay',
  shortName: 'overlay',
  logoSrc: '/assets/overlay-logo.png',
  logoAlt: '',
  homeHref: '/app/chat',
  supportEmail: 'divyansh@layernorm.co',
  organizationName: 'Overlay',
}

export const DEFAULT_OVERLAY_FEATURE_FLAGS: readonly OverlayFeatureFlag[] = [
  {
    id: 'voiceTranscription',
    label: 'Voice transcription',
    enabled: true,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    enabled: true,
  },
  {
    id: 'projects',
    label: 'Projects',
    enabled: true,
  },
  {
    id: 'automations',
    label: 'Automations',
    enabled: true,
  },
  {
    id: 'extensions',
    label: 'Extensions',
    enabled: true,
  },
] as const

export const DEFAULT_OVERLAY_NAVIGATION: readonly OverlayNavigationItem[] = [
  { id: 'chat', href: '/app/chat', label: 'Chat', icon: 'message-square' },
  { id: 'files', href: '/app/files', label: 'Files', icon: 'file-text' },
  {
    id: 'extensions',
    href: '/app/tools',
    label: 'Extensions',
    icon: 'puzzle',
    featureFlagId: 'extensions',
    subviews: ['connectors', 'skills', 'mcps', 'apps', 'all'],
  },
  {
    id: 'projects',
    href: '/app/projects',
    label: 'Projects',
    icon: 'folder-open',
    featureFlagId: 'projects',
  },
  {
    id: 'automations',
    href: '/app/automations',
    label: 'Automations',
    icon: 'workflow',
    featureFlagId: 'automations',
  },
] as const

export const DEFAULT_OVERLAY_SETTINGS_SECTIONS: readonly OverlaySettingsSection[] = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'memories', label: 'Memories', featureFlagId: 'knowledge' },
  { id: 'models', label: 'Models' },
  { id: 'contact', label: 'Contact' },
] as const

export const DEFAULT_OVERLAY_THEME_METADATA: OverlayThemeMetadata = {
  defaultLightPreset: 'default-light',
  defaultDarkPreset: 'default-dark',
  presets: PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    variant: preset.variant,
    previewColors: preset.previewColors,
  })),
  cssVarKeys: PRESET_CSS_VAR_KEYS,
}

export const DEFAULT_OVERLAY_APP_CONFIG: OverlayAppConfig = {
  brand: DEFAULT_OVERLAY_BRAND_CONFIG,
  navigation: DEFAULT_OVERLAY_NAVIGATION,
  settingsSections: DEFAULT_OVERLAY_SETTINGS_SECTIONS,
  featureFlags: DEFAULT_OVERLAY_FEATURE_FLAGS,
  theme: DEFAULT_OVERLAY_THEME_METADATA,
}

const FEATURE_FLAG_TO_APP_FLAG: Partial<Record<OverlayFeatureFlagId, keyof AppFeatureFlags>> = {
  voiceTranscription: 'canUseVoiceTranscription',
  knowledge: 'canUseKnowledge',
  projects: 'canUseProjects',
  automations: 'canUseAutomations',
  extensions: 'canUseExtensions',
}

export function defineOverlayAppConfig(config: OverlayAppConfig): OverlayAppConfig {
  return config
}

export function overlayFeatureFlagsToAppFeatureFlags(
  flags: readonly OverlayFeatureFlag[],
): AppFeatureFlags {
  const next: AppFeatureFlags = {
    canUseVoiceTranscription: true,
    canUseKnowledge: true,
    canUseProjects: true,
    canUseAutomations: true,
    canUseExtensions: true,
  }

  for (const flag of flags) {
    const key = FEATURE_FLAG_TO_APP_FLAG[flag.id]
    if (key) next[key] = flag.enabled
  }

  return next
}

export function isOverlayFeatureEnabled(
  featureFlagId: OverlayFeatureFlagId | undefined,
  flags: readonly OverlayFeatureFlag[],
): boolean {
  if (!featureFlagId) return true
  return flags.find((flag) => flag.id === featureFlagId)?.enabled ?? true
}

export function resolveOverlayAppShellConfig(
  config: OverlayAppConfig = DEFAULT_OVERLAY_APP_CONFIG,
): OverlayAppShellRegistry {
  const featureFlags = config.featureFlags ?? DEFAULT_OVERLAY_FEATURE_FLAGS
  const brand = {
    ...DEFAULT_OVERLAY_BRAND_CONFIG,
    ...config.brand,
  }
  const theme = {
    ...DEFAULT_OVERLAY_THEME_METADATA,
    ...config.theme,
    presets: config.theme?.presets ?? DEFAULT_OVERLAY_THEME_METADATA.presets,
    cssVarKeys: config.theme?.cssVarKeys ?? DEFAULT_OVERLAY_THEME_METADATA.cssVarKeys,
  }
  const navigation = (config.navigation ?? DEFAULT_OVERLAY_NAVIGATION).filter((item) =>
    isOverlayFeatureEnabled(item.featureFlagId, featureFlags),
  )
  const settingsSections = (config.settingsSections ?? DEFAULT_OVERLAY_SETTINGS_SECTIONS).filter(
    (section) => isOverlayFeatureEnabled(section.featureFlagId, featureFlags),
  )

  return {
    brand,
    navigation,
    settingsSections,
    featureFlags,
    appFeatureFlags: overlayFeatureFlagsToAppFeatureFlags(featureFlags),
    theme,
  }
}

export function overlayNavigationToDestinations(
  navigation: readonly OverlayNavigationItem[],
  settingsSections: readonly OverlaySettingsSection[] = DEFAULT_OVERLAY_SETTINGS_SECTIONS,
): AppDestinationConfig[] {
  const destinations: AppDestinationConfig[] = navigation.map((item) => ({
    id: item.id as AppDestinationConfig['id'],
    label: item.label,
    href: item.href,
    ...(item.subviews?.length ? { subviews: item.subviews } : {}),
  }))

  destinations.push({
    id: 'settings',
    label: 'Settings',
    href: '/app/settings',
    subviews: settingsSections.map((section) => section.id),
  })
  destinations.push({ id: 'account', label: 'Account', href: '/account' })

  return destinations
}

export const DEFAULT_LIGHT_THEME_PRESET_IDS: readonly ThemePresetId[] = LIGHT_PRESETS.map(
  (preset) => preset.id,
)
export const DEFAULT_DARK_THEME_PRESET_IDS: readonly ThemePresetId[] = DARK_PRESETS.map(
  (preset) => preset.id,
)
