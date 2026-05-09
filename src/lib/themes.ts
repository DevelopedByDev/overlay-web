import type { ThemePresetId } from '@overlay/app-core'

export interface ThemePreset {
  id: ThemePresetId
  name: string
  variant: 'light' | 'dark'
  cssVars: Record<string, string>
  previewColors: {
    background: string
    accent: string
  }
}

const LIGHT_BASE: Record<string, string> = {
  '--background': '#fafafa',
  '--foreground': '#0a0a0a',
  '--muted': '#71717a',
  '--muted-light': '#a1a1aa',
  '--border': '#e4e4e7',
  '--surface-elevated': '#ffffff',
  '--surface-muted': '#f5f5f5',
  '--surface-subtle': '#f0f0f0',
  '--sidebar-surface': '#f5f5f5',
  '--glass-bg': 'rgba(255, 255, 255, 0.7)',
  '--glass-border': 'rgba(255, 255, 255, 0.5)',
  '--selection-bg': 'rgba(0, 0, 0, 0.1)',
  '--scrollbar-thumb': '#d4d4d8',
  '--scrollbar-thumb-hover': '#a1a1aa',
  '--overlay-scrim': 'rgba(0, 0, 0, 0.4)',
  '--chat-badge-free-bg': '#ecfdf5',
  '--chat-badge-free-fg': '#065f46',
  '--chat-badge-upgrade-bg': '#fef9ec',
  '--chat-badge-upgrade-fg': '#b45309',
  '--chat-badge-upgrade-hover': '#fde68a',
  '--chat-alert-error-bg': '#fef2f2',
  '--chat-alert-error-border': '#fecaca',
  '--chat-alert-error-text': '#dc2626',
  '--chat-alert-warn-bg': '#fffbeb',
  '--chat-alert-warn-border': '#fde68a',
  '--chat-alert-warn-text': '#92400e',
  '--chat-media-error-bg': 'linear-gradient(180deg, #fffafa 0%, #fff5f5 100%)',
  '--chat-media-error-border': '#fecaca',
  '--tool-line-label': '#52525b',
  '--tool-line-chevron': '#a1a1aa',
}

const DARK_BASE: Record<string, string> = {
  '--background': '#09090b',
  '--foreground': '#f5f5f5',
  '--muted': '#a1a1aa',
  '--muted-light': '#71717a',
  '--border': '#27272a',
  '--surface-elevated': '#111113',
  '--surface-muted': '#151518',
  '--surface-subtle': '#1c1c20',
  '--sidebar-surface': '#111113',
  '--glass-bg': 'rgba(17, 17, 19, 0.72)',
  '--glass-border': 'rgba(255, 255, 255, 0.08)',
  '--selection-bg': 'rgba(255, 255, 255, 0.16)',
  '--scrollbar-thumb': '#3f3f46',
  '--scrollbar-thumb-hover': '#52525b',
  '--overlay-scrim': 'rgba(0, 0, 0, 0.58)',
  '--chat-badge-free-bg': 'rgba(16, 185, 129, 0.16)',
  '--chat-badge-free-fg': '#6ee7b7',
  '--chat-badge-upgrade-bg': 'rgba(245, 158, 11, 0.14)',
  '--chat-badge-upgrade-fg': '#fbbf24',
  '--chat-badge-upgrade-hover': 'rgba(245, 158, 11, 0.22)',
  '--chat-alert-error-bg': 'rgba(127, 29, 29, 0.45)',
  '--chat-alert-error-border': 'rgba(248, 113, 113, 0.28)',
  '--chat-alert-error-text': '#fecaca',
  '--chat-alert-warn-bg': 'rgba(120, 53, 15, 0.45)',
  '--chat-alert-warn-border': 'rgba(251, 191, 36, 0.25)',
  '--chat-alert-warn-text': '#fde68a',
  '--chat-media-error-bg': 'linear-gradient(180deg, rgba(127, 29, 29, 0.35) 0%, rgba(69, 10, 10, 0.5) 100%)',
  '--chat-media-error-border': 'rgba(248, 113, 113, 0.3)',
  '--tool-line-label': '#d4d4d8',
  '--tool-line-chevron': '#c4c4c4',
}

export const PRESETS: ThemePreset[] = [
  {
    id: 'default-light',
    name: 'Default',
    variant: 'light',
    cssVars: LIGHT_BASE,
    previewColors: { background: '#fafafa', accent: '#0a0a0a' },
  },
  {
    id: 'default-dark',
    name: 'Default',
    variant: 'dark',
    cssVars: DARK_BASE,
    previewColors: { background: '#09090b', accent: '#f5f5f5' },
  },
  {
    id: 'codex',
    name: 'Codex',
    variant: 'dark',
    cssVars: {
      ...DARK_BASE,
      '--background': '#0c1222',
      '--foreground': '#e8e6e1',
      '--muted': '#8b8680',
      '--muted-light': '#6b665e',
      '--border': '#1e2a3d',
      '--surface-elevated': '#111a2e',
      '--surface-muted': '#131d33',
      '--surface-subtle': '#1a2640',
      '--sidebar-surface': '#111a2e',
      '--glass-bg': 'rgba(17, 26, 46, 0.72)',
      '--glass-border': 'rgba(255, 255, 255, 0.06)',
      '--selection-bg': 'rgba(255, 200, 100, 0.12)',
      '--scrollbar-thumb': '#2a3a55',
      '--scrollbar-thumb-hover': '#3a5070',
      '--overlay-scrim': 'rgba(0, 0, 0, 0.6)',
    },
    previewColors: { background: '#0c1222', accent: '#fbbf24' },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    variant: 'dark',
    cssVars: {
      ...DARK_BASE,
      '--background': '#1e1e2e',
      '--foreground': '#cdd6f4',
      '--muted': '#a6adc8',
      '--muted-light': '#7f849c',
      '--border': '#313244',
      '--surface-elevated': '#242438',
      '--surface-muted': '#2a2a40',
      '--surface-subtle': '#313244',
      '--sidebar-surface': '#242438',
      '--glass-bg': 'rgba(36, 36, 56, 0.72)',
      '--glass-border': 'rgba(255, 255, 255, 0.06)',
      '--selection-bg': 'rgba(180, 190, 254, 0.15)',
      '--scrollbar-thumb': '#45475a',
      '--scrollbar-thumb-hover': '#585b70',
      '--overlay-scrim': 'rgba(0, 0, 0, 0.6)',
    },
    previewColors: { background: '#1e1e2e', accent: '#b4befe' },
  },
]

export const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]))
export const LIGHT_PRESETS = PRESETS.filter((p) => p.variant === 'light')
export const DARK_PRESETS = PRESETS.filter((p) => p.variant === 'dark')

export function getPresetCssVars(id: ThemePresetId): Record<string, string> {
  return PRESET_MAP.get(id)?.cssVars ?? {}
}

/** Canonical list of CSS custom property names that presets may override. */
export const PRESET_CSS_VAR_KEYS = Object.keys(LIGHT_BASE)
