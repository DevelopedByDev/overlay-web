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
export type ChatStreamingMode = 'token' | 'chunk'

export type AppSettings = {
  theme: ThemePreference
  useSecondarySidebar: boolean
  chatStreamingMode: ChatStreamingMode
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
  chatStreamingMode: 'token',
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)
const APP_SETTINGS_STORAGE_KEY = 'overlay.app.settings'

function isAppSettingsPayload(value: unknown): value is Partial<AppSettings> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppSettings>
  if (candidate.theme !== undefined && candidate.theme !== 'light' && candidate.theme !== 'dark') return false
  if (candidate.useSecondarySidebar !== undefined && typeof candidate.useSecondarySidebar !== 'boolean') return false
  if (
    candidate.chatStreamingMode !== undefined &&
    candidate.chatStreamingMode !== 'token' &&
    candidate.chatStreamingMode !== 'chunk'
  ) {
    return false
  }
  return (
    typeof candidate.theme === 'string' ||
    typeof candidate.useSecondarySidebar === 'boolean' ||
    typeof candidate.chatStreamingMode === 'string'
  )
}

function readStoredSettings(): AppSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isAppSettingsPayload(parsed)) return null
    // Back-fill defaults for fields added in later releases so older cached payloads
    // don't lock the user into stale settings.
    return { ...DEFAULT_APP_SETTINGS, ...parsed }
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
      setSettings(stored)
    }

    try {
      const res = await fetch('/api/app/settings', { cache: 'no-store' })
      if (res.ok) {
        const next = await res.json() as AppSettings
        setSettings(next)
        persistSettings(next)
      } else if (res.status === 401) {
        setSettings(stored ?? DEFAULT_APP_SETTINGS)
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
