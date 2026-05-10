import * as React from 'react'
import { LIGHT_TOKENS, DARK_TOKENS } from './tokens'

export interface ThemeContextValue {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
})

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext)
}

function applyTokens(theme: 'light' | 'dark') {
  const tokens = theme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value)
  }
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: 'light' | 'dark'
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<'light' | 'dark'>(defaultTheme)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('overlay.app.settings')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.theme === 'light' || parsed.theme === 'dark') {
          setThemeState(parsed.theme)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    applyTokens(theme)
  }, [theme])

  const setTheme = React.useCallback((next: 'light' | 'dark') => {
    setThemeState(next)
    try {
      const raw = window.localStorage.getItem('overlay.app.settings') || '{}'
      const parsed = JSON.parse(raw)
      parsed.theme = next
      window.localStorage.setItem('overlay.app.settings', JSON.stringify(parsed))
    } catch {
      // ignore
    }
  }, [])

  const value = React.useMemo(
    () => ({ theme, setTheme }),
    [theme, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}
