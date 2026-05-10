import type { ThemePresetId } from '@overlay/app-core'
import { LIGHT_TOKENS, DARK_TOKENS } from '@overlay/ui'

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

const LIGHT_BASE: Record<string, string> = LIGHT_TOKENS

const DARK_BASE: Record<string, string> = DARK_TOKENS

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
