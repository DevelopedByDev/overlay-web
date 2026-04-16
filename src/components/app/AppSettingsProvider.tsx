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
  experimentalGenerativeUI: boolean
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
  experimentalGenerativeUI: false,
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)
const APP_SETTINGS_STORAGE_KEY = 'overlay.app.settings'

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppSettings>
  return (
    (candidate.theme === 'light' || candidate.theme === 'dark') &&
    typeof candidate.useSecondarySidebar === 'boolean'
  )
}

function hydrateAppSettings(raw: unknown): AppSettings {
  const base = isAppSettings(raw) ? raw : DEFAULT_APP_SETTINGS
  return {
    ...DEFAULT_APP_SETTINGS,
    ...base,
    // Coerce optional booleans that older stored values may not have
    experimentalGenerativeUI: typeof (raw as Partial<AppSettings>).experimentalGenerativeUI === 'boolean'
      ? (raw as Partial<AppSettings>).experimentalGenerativeUI!
      : false,
  }
}

function readStoredSettings(): AppSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isAppSettings(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage failures and keep in-memory settings.
  }
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const refresh = useCallback(async () => {
    const stored = readStoredSettings()
    if (stored) {
      setSettings(hydrateAppSettings(stored))
    }

    try {
      const res = await fetch('/api/app/settings', { cache: 'no-store' })
      if (res.ok) {
        const next = hydrateAppSettings(await res.json())
        setSettings(next)
        persistSettings(next)
      } else if (res.status === 401) {
        setSettings(stored ? hydrateAppSettings(stored) : DEFAULT_APP_SETTINGS)
      }
    } catch {
      if (!stored) {
        setSettings(DEFAULT_APP_SETTINGS)
      }
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
    const optimistic = { ...settings, ...patch }
    setSettings(optimistic)
    persistSettings(optimistic)
    setIsSaving(true)
    try {
      const res = await fetch('/api/app/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        console.warn('Failed to save settings to server; using local state')
        return optimistic
      }
      const saved = await res.json() as AppSettings
      setSettings(saved)
      persistSettings(saved)
      return saved
    } catch (error) {
      console.warn('Failed to save settings to server; using local state', error)
      return optimistic
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
