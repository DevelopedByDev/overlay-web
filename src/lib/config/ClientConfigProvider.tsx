'use client'

import type { ReactNode } from 'react'
import type { OverlayConfigType } from './schema'
import { OverlayConfigContext } from './useConfig'

export function ClientConfigProvider({
  children,
  config,
}: {
  children: ReactNode
  config: OverlayConfigType
}) {
  return (
    <OverlayConfigContext.Provider value={config}>
      {children}
    </OverlayConfigContext.Provider>
  )
}
