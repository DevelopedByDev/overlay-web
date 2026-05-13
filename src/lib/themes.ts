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

type CodexTheme = {
  accent: string
  contrast: number
  fonts: {
    code: string | null
    ui: string | null
  }
  ink: string
  opaqueWindows: boolean
  semanticColors: {
    diffAdded: string
    diffRemoved: string
    skill: string
  }
  surface: string
}

type CodexPresetDefinition = {
  id: ThemePresetId
  name: string
  variant: 'light' | 'dark'
  codeThemeId: string
  theme: CodexTheme
}

const DEFAULT_UI_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const DEFAULT_MONO_FONT = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"

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
  '--font-sans': DEFAULT_UI_FONT,
  '--font-mono': DEFAULT_MONO_FONT,
  '--accent': '#0a0a0a',
  '--skill': '#751ed9',
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
  '--button-primary-bg': '#0a0a0a',
  '--button-primary-text': '#ffffff',
  '--button-secondary-bg': '#ffffff',
  '--button-secondary-border': '#e4e4e7',
  '--button-secondary-text': '#0a0a0a',
  '--input-background': '#ffffff',
  '--input-border': '#e4e4e7',
  '--input-text': '#0a0a0a',
  '--input-placeholder': '#a1a1aa',
  '--success': '#10b981',
  '--warning': '#f59e0b',
  '--danger': '#ef4444',
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
  '--font-sans': DEFAULT_UI_FONT,
  '--font-mono': DEFAULT_MONO_FONT,
  '--accent': '#f5f5f5',
  '--skill': '#b06dff',
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
  '--button-primary-bg': '#f5f5f5',
  '--button-primary-text': '#09090b',
  '--button-secondary-bg': '#111113',
  '--button-secondary-border': '#27272a',
  '--button-secondary-text': '#f5f5f5',
  '--input-background': '#111113',
  '--input-border': '#27272a',
  '--input-text': '#f5f5f5',
  '--input-placeholder': '#71717a',
  '--success': '#34d399',
  '--warning': '#fbbf24',
  '--danger': '#f87171',
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

function mix(hex: string, target: string, amount: number) {
  const [r1, g1, b1] = hexToRgb(hex)
  const [r2, g2, b2] = hexToRgb(target)
  return rgbToHex([
    r1 + (r2 - r1) * amount,
    g1 + (g2 - g1) * amount,
    b1 + (b2 - b1) * amount,
  ])
}

function alpha(hex: string, opacity: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function fontStack(font: string | null, fallback: string) {
  if (!font) return fallback
  return `${font}, ${fallback}`
}

function varsFromCodexTheme({ variant, theme }: Pick<CodexPresetDefinition, 'variant' | 'theme'>): Record<string, string> {
  const isDark = variant === 'dark'
  const base = isDark ? DARK_BASE : LIGHT_BASE
  const surfaceTarget = isDark ? '#ffffff' : '#000000'
  const inkTarget = isDark ? '#000000' : '#ffffff'
  const elevatedMix = isDark ? 0.045 : 0.015
  const mutedMix = isDark ? 0.075 : 0.035
  const subtleMix = isDark ? 0.12 : 0.06

  return {
    ...base,
    '--background': theme.surface,
    '--foreground': theme.ink,
    '--muted': mix(theme.ink, theme.surface, isDark ? 0.34 : 0.44),
    '--muted-light': mix(theme.ink, theme.surface, isDark ? 0.52 : 0.62),
    '--border': mix(theme.surface, theme.ink, isDark ? 0.18 : 0.12),
    '--surface-elevated': mix(theme.surface, surfaceTarget, elevatedMix),
    '--surface-muted': mix(theme.surface, surfaceTarget, mutedMix),
    '--surface-subtle': mix(theme.surface, surfaceTarget, subtleMix),
    '--sidebar-surface': theme.opaqueWindows ? mix(theme.surface, surfaceTarget, elevatedMix) : theme.surface,
    '--glass-bg': theme.opaqueWindows ? mix(theme.surface, surfaceTarget, elevatedMix) : alpha(mix(theme.surface, surfaceTarget, elevatedMix), 0.72),
    '--glass-border': isDark ? alpha(theme.ink, 0.08) : alpha(theme.ink, 0.1),
    '--selection-bg': alpha(theme.accent, isDark ? 0.22 : 0.14),
    '--scrollbar-thumb': mix(theme.surface, theme.ink, isDark ? 0.24 : 0.18),
    '--scrollbar-thumb-hover': mix(theme.surface, theme.ink, isDark ? 0.34 : 0.28),
    '--overlay-scrim': isDark ? 'rgba(0, 0, 0, 0.58)' : 'rgba(0, 0, 0, 0.4)',
    '--font-sans': fontStack(theme.fonts.ui, DEFAULT_UI_FONT),
    '--font-mono': fontStack(theme.fonts.code, DEFAULT_MONO_FONT),
    '--accent': theme.accent,
    '--skill': theme.semanticColors.skill,
    '--chat-badge-free-bg': alpha(theme.semanticColors.diffAdded, isDark ? 0.16 : 0.12),
    '--chat-badge-free-fg': isDark ? mix(theme.semanticColors.diffAdded, '#ffffff', 0.25) : mix(theme.semanticColors.diffAdded, '#000000', 0.32),
    '--chat-badge-upgrade-bg': alpha(theme.accent, isDark ? 0.14 : 0.12),
    '--chat-badge-upgrade-fg': isDark ? mix(theme.accent, '#ffffff', 0.18) : mix(theme.accent, '#000000', 0.2),
    '--chat-badge-upgrade-hover': alpha(theme.accent, isDark ? 0.22 : 0.2),
    '--chat-alert-error-bg': alpha(theme.semanticColors.diffRemoved, isDark ? 0.18 : 0.08),
    '--chat-alert-error-border': alpha(theme.semanticColors.diffRemoved, isDark ? 0.3 : 0.24),
    '--chat-alert-error-text': isDark ? mix(theme.semanticColors.diffRemoved, '#ffffff', 0.3) : mix(theme.semanticColors.diffRemoved, '#000000', 0.12),
    '--chat-alert-warn-bg': alpha(theme.accent, isDark ? 0.16 : 0.1),
    '--chat-alert-warn-border': alpha(theme.accent, isDark ? 0.28 : 0.2),
    '--chat-alert-warn-text': isDark ? mix(theme.accent, '#ffffff', 0.28) : mix(theme.accent, '#000000', 0.16),
    '--chat-media-error-bg': `linear-gradient(180deg, ${alpha(theme.semanticColors.diffRemoved, isDark ? 0.16 : 0.08)} 0%, ${alpha(theme.semanticColors.diffRemoved, isDark ? 0.24 : 0.12)} 100%)`,
    '--chat-media-error-border': alpha(theme.semanticColors.diffRemoved, isDark ? 0.3 : 0.24),
    '--tool-line-label': mix(theme.ink, theme.surface, isDark ? 0.18 : 0.3),
    '--tool-line-chevron': mix(theme.ink, theme.surface, isDark ? 0.34 : 0.5),
    '--button-primary-bg': theme.accent,
    '--button-primary-text': mix(theme.accent, inkTarget, 0.88),
    '--button-secondary-bg': mix(theme.surface, surfaceTarget, elevatedMix),
    '--button-secondary-border': mix(theme.surface, theme.ink, isDark ? 0.18 : 0.12),
    '--button-secondary-text': theme.ink,
    '--input-background': mix(theme.surface, surfaceTarget, elevatedMix),
    '--input-border': mix(theme.surface, theme.ink, isDark ? 0.18 : 0.12),
    '--input-text': theme.ink,
    '--input-placeholder': mix(theme.ink, theme.surface, isDark ? 0.48 : 0.58),
    '--success': theme.semanticColors.diffAdded,
    '--warning': theme.accent,
    '--danger': theme.semanticColors.diffRemoved,
  }
}

const CODEX_THEME_DEFINITIONS: CodexPresetDefinition[] = [
  {
    id: 'absolutely-light',
    name: 'Absolutely',
    variant: 'light',
    codeThemeId: 'absolutely',
    theme: {
      accent: '#cc7d5e',
      contrast: 45,
      fonts: { code: null, ui: null },
      ink: '#2d2d2b',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#00c853', diffRemoved: '#ff5f38', skill: '#cc7d5e' },
      surface: '#f9f9f7',
    },
  },
  {
    id: 'catppuccin-light',
    name: 'Catppuccin',
    variant: 'light',
    codeThemeId: 'catppuccin',
    theme: {
      accent: '#8839ef',
      contrast: 45,
      fonts: { code: null, ui: null },
      ink: '#4c4f69',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#40a02b', diffRemoved: '#d20f39', skill: '#8839ef' },
      surface: '#eff1f5',
    },
  },
  {
    id: 'codex-light',
    name: 'Codex',
    variant: 'light',
    codeThemeId: 'codex',
    theme: {
      accent: '#0169cc',
      contrast: 45,
      fonts: { code: null, ui: null },
      ink: '#0d0d0d',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#00a240', diffRemoved: '#e02e2a', skill: '#751ed9' },
      surface: '#ffffff',
    },
  },
  {
    id: 'absolutely',
    name: 'Absolutely',
    variant: 'dark',
    codeThemeId: 'absolutely',
    theme: {
      accent: '#cc7d5e',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#f9f9f7',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#00c853', diffRemoved: '#ff5f38', skill: '#cc7d5e' },
      surface: '#2d2d2b',
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    variant: 'dark',
    codeThemeId: 'codex',
    theme: {
      accent: '#0169cc',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#fcfcfc',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#00a240', diffRemoved: '#e02e2a', skill: '#b06dff' },
      surface: '#111111',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    variant: 'dark',
    codeThemeId: 'dracula',
    theme: {
      accent: '#ff79c6',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#f8f8f2',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#50fa7b', diffRemoved: '#ff5555', skill: '#ff79c6' },
      surface: '#282a36',
    },
  },
  {
    id: 'everforest',
    name: 'Everforest',
    variant: 'dark',
    codeThemeId: 'everforest',
    theme: {
      accent: '#a7c080',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#d3c6aa',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#a7c080', diffRemoved: '#e67e80', skill: '#d699b6' },
      surface: '#2d353b',
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    variant: 'dark',
    codeThemeId: 'github',
    theme: {
      accent: '#1f6feb',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#e6edf3',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#3fb950', diffRemoved: '#f85149', skill: '#bc8cff' },
      surface: '#0d1117',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    variant: 'dark',
    codeThemeId: 'gruvbox',
    theme: {
      accent: '#458588',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#ebdbb2',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#ebdbb2', diffRemoved: '#cc241d', skill: '#b16286' },
      surface: '#282828',
    },
  },
  {
    id: 'linear',
    name: 'Linear',
    variant: 'dark',
    codeThemeId: 'linear',
    theme: {
      accent: '#606acc',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Inter' },
      ink: '#e3e4e6',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#69c967', diffRemoved: '#ff7e78', skill: '#c2a1ff' },
      surface: '#0f0f11',
    },
  },
  {
    id: 'lobster',
    name: 'Lobster',
    variant: 'dark',
    codeThemeId: 'lobster',
    theme: {
      accent: '#ff5c5c',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Satoshi' },
      ink: '#e4e4e7',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#22c55e', diffRemoved: '#ff5c5c', skill: '#3b82f6' },
      surface: '#111827',
    },
  },
  {
    id: 'material',
    name: 'Material',
    variant: 'dark',
    codeThemeId: 'material',
    theme: {
      accent: '#80cbc4',
      contrast: 27,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Satoshi' },
      ink: '#eeffff',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#c3e88d', diffRemoved: '#f07178', skill: '#c792ea' },
      surface: '#212121',
    },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    variant: 'dark',
    codeThemeId: 'matrix',
    theme: {
      accent: '#1eff5a',
      contrast: 27,
      fonts: { code: null, ui: 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
      ink: '#b8ffca',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#1eff5a', diffRemoved: '#fa423e', skill: '#1eff5a' },
      surface: '#040805',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    variant: 'dark',
    codeThemeId: 'monokai',
    theme: {
      accent: '#99947c',
      contrast: 27,
      fonts: { code: null, ui: 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
      ink: '#f8f8f2',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#86b42b', diffRemoved: '#c4265e', skill: '#8c6bc8' },
      surface: '#272822',
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    variant: 'dark',
    codeThemeId: 'night-owl',
    theme: {
      accent: '#44596b',
      contrast: 27,
      fonts: { code: null, ui: 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
      ink: '#d6deeb',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#c5e478', diffRemoved: '#ef5350', skill: '#c792ea' },
      surface: '#011627',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    variant: 'dark',
    codeThemeId: 'nord',
    theme: {
      accent: '#88c0d0',
      contrast: 27,
      fonts: { code: null, ui: 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
      ink: '#d8dee9',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#a3be8c', diffRemoved: '#bf616a', skill: '#b48ead' },
      surface: '#2e3440',
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    variant: 'dark',
    codeThemeId: 'notion',
    theme: {
      accent: '#3183d8',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#d9d9d8',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#4ec9b0', diffRemoved: '#fa423e', skill: '#3183d8' },
      surface: '#191919',
    },
  },
  {
    id: 'one',
    name: 'One',
    variant: 'dark',
    codeThemeId: 'one',
    theme: {
      accent: '#4d78cc',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#abb2bf',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#8cc265', diffRemoved: '#e05561', skill: '#c162de' },
      surface: '#282c34',
    },
  },
  {
    id: 'oscurange',
    name: 'Oscurange',
    variant: 'dark',
    codeThemeId: 'oscurange',
    theme: {
      accent: '#f9b98c',
      contrast: 27,
      fonts: { code: '"Jetbrains Mono"', ui: 'Inter' },
      ink: '#e6e6e6',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#40c977', diffRemoved: '#fa423e', skill: '#479ffa' },
      surface: '#0b0b0f',
    },
  },
  {
    id: 'raycast',
    name: 'Raycast',
    variant: 'dark',
    codeThemeId: 'raycast',
    theme: {
      accent: '#ff6363',
      contrast: 27,
      fonts: { code: '"Jetbrains Mono"', ui: 'Inter' },
      ink: '#fefefe',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#59d499', diffRemoved: '#ff6363', skill: '#cf2f98' },
      surface: '#101010',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rose Pine',
    variant: 'dark',
    codeThemeId: 'rose-pine',
    theme: {
      accent: '#ea9a97',
      contrast: 27,
      fonts: { code: '"Jetbrains Mono"', ui: 'Inter' },
      ink: '#e0def4',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#9ccfd8', diffRemoved: '#908caa', skill: '#c4a7e7' },
      surface: '#232136',
    },
  },
  {
    id: 'sentry',
    name: 'Sentry',
    variant: 'dark',
    codeThemeId: 'sentry',
    theme: {
      accent: '#7055f6',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#e6dff9',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#8ee6d7', diffRemoved: '#fa423e', skill: '#7055f6' },
      surface: '#2d2935',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    variant: 'dark',
    codeThemeId: 'solarized',
    theme: {
      accent: '#d30102',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#839496',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#859900', diffRemoved: '#dc322f', skill: '#d33682' },
      surface: '#002b36',
    },
  },
  {
    id: 'temple',
    name: 'Temple',
    variant: 'dark',
    codeThemeId: 'temple',
    theme: {
      accent: '#e4f222',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#c7e6da',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#40c977', diffRemoved: '#fa423e', skill: '#e4f222' },
      surface: '#02120c',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    variant: 'dark',
    codeThemeId: 'tokyo-night',
    theme: {
      accent: '#3d59a1',
      contrast: 27,
      fonts: { code: null, ui: null },
      ink: '#a9b1d6',
      opaqueWindows: false,
      semanticColors: { diffAdded: '#449dab', diffRemoved: '#914c54', skill: '#9d7cd8' },
      surface: '#1a1b26',
    },
  },
  {
    id: 'vercel',
    name: 'Vercel',
    variant: 'dark',
    codeThemeId: 'vercel',
    theme: {
      accent: '#006efe',
      contrast: 50,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Geist, Inter' },
      ink: '#ededed',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#00ad3a', diffRemoved: '#f13342', skill: '#9540d5' },
      surface: '#000000',
    },
  },
  {
    id: 'vscode-plus',
    name: 'VS Code+',
    variant: 'dark',
    codeThemeId: 'vscode-plus',
    theme: {
      accent: '#007acc',
      contrast: 50,
      fonts: { code: '"Geist Mono", ui-monospace, "SFMono-Regular"', ui: 'Geist, Inter' },
      ink: '#d4d4d4',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#369432', diffRemoved: '#f44747', skill: '#000080' },
      surface: '#1e1e1e',
    },
  },
  {
    id: 'xcode',
    name: 'Xcode',
    variant: 'dark',
    codeThemeId: 'xcode',
    theme: {
      accent: '#5482ff',
      contrast: 50,
      fonts: { code: '"SFMono-Medium"', ui: 'Geist, Inter' },
      ink: '#ffffff',
      opaqueWindows: true,
      semanticColors: { diffAdded: '#67b7a4', diffRemoved: '#fc6a5d', skill: '#5482ff' },
      surface: '#1f1f24',
    },
  },
]

const CODEX_THEME_PRESETS: ThemePreset[] = CODEX_THEME_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  variant: definition.variant,
  cssVars: varsFromCodexTheme(definition),
  previewColors: {
    background: definition.theme.surface,
    accent: definition.theme.accent,
  },
}))

const LEGACY_CATPPUCCIN_DARK: ThemePreset = {
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
    '--accent': '#b4befe',
    '--skill': '#cba6f7',
  },
  previewColors: { background: '#1e1e2e', accent: '#b4befe' },
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
  ...CODEX_THEME_PRESETS,
  LEGACY_CATPPUCCIN_DARK,
]

export const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]))
export const PRESET_IDS = PRESETS.map((p) => p.id)
export const LIGHT_PRESETS = PRESETS.filter((p) => p.variant === 'light')
export const DARK_PRESETS = PRESETS.filter((p) => p.variant === 'dark')

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === 'string' && PRESET_MAP.has(value as ThemePresetId)
}

export function getPresetCssVars(id: ThemePresetId): Record<string, string> {
  return PRESET_MAP.get(id)?.cssVars ?? {}
}

/** Canonical list of CSS custom property names that presets may override. */
export const PRESET_CSS_VAR_KEYS = Object.keys(LIGHT_BASE)
