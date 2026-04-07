'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'

export type ThemePreference = 'light' | 'dark'

export type AppSettings = {
  theme: ThemePreference
  useSecondarySidebar: boolean
}

type AppSettingsContextValue = {
  settings: AppSettings
  isLoading: boolean
  isSaving: boolean
  refresh: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  useSecondarySidebar: false,
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/app/settings', { cache: 'no-store' })
      if (res.ok) {
        setSettings(await res.json() as AppSettings)
      } else if (res.status === 401) {
        setSettings(DEFAULT_APP_SETTINGS)
      }
    } catch {
      // Keep defaults when settings are unavailable.
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.style.colorScheme = settings.theme
  }, [settings.theme])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const previous = settings
    const optimistic = { ...settings, ...patch }
    setSettings(optimistic)
    setIsSaving(true)
    try {
      const res = await fetch('/api/app/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        throw new Error('Failed to save settings')
      }
      const saved = await res.json() as AppSettings
      setSettings(saved)
      return saved
    } catch (error) {
      setSettings(previous)
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [settings])

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    isLoading,
    isSaving,
    refresh,
    updateSettings,
  }), [settings, isLoading, isSaving, refresh, updateSettings])

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }
  return ctx
}
