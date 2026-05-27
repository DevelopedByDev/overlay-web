'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEFAULT_OVERLAY_CAPABILITIES,
  type CapabilityCheck,
} from '@overlay/app-core'

type CapabilitiesContextValue = {
  capabilities: CapabilityCheck
  isLoading: boolean
}

const CapabilitiesContext = createContext<CapabilitiesContextValue | null>(null)

function normalizeCapabilities(value: unknown): CapabilityCheck | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CapabilityCheck>
  const keys = Object.keys(DEFAULT_OVERLAY_CAPABILITIES) as Array<keyof CapabilityCheck>
  if (!keys.every((key) => candidate[key] === undefined || typeof candidate[key] === 'boolean')) {
    return null
  }
  return { ...DEFAULT_OVERLAY_CAPABILITIES, ...candidate }
}

export function CapabilitiesProvider({
  children,
  initialCapabilities,
}: {
  children: React.ReactNode
  initialCapabilities?: CapabilityCheck
}) {
  const [capabilities, setCapabilities] = useState<CapabilityCheck>(
    initialCapabilities ?? DEFAULT_OVERLAY_CAPABILITIES,
  )
  const [isLoading, setIsLoading] = useState(!initialCapabilities)

  useEffect(() => {
    if (initialCapabilities) return
    let active = true
    void fetch('/api/v1/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return await response.json()
      })
      .then((payload) => {
        const next = normalizeCapabilities(payload?.capabilities)
        if (active && next) setCapabilities(next)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [initialCapabilities])

  const value = useMemo(
    () => ({ capabilities, isLoading }),
    [capabilities, isLoading],
  )

  return (
    <CapabilitiesContext.Provider value={value}>
      {children}
    </CapabilitiesContext.Provider>
  )
}

export function useOverlayCapabilities(): CapabilitiesContextValue {
  return useContext(CapabilitiesContext) ?? {
    capabilities: DEFAULT_OVERLAY_CAPABILITIES,
    isLoading: true,
  }
}
