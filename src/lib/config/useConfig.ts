'use client'

import { createContext, useContext } from 'react'
import type { OverlayConfigType } from './schema'

export const OverlayConfigContext = createContext<OverlayConfigType | null>(null)

export function useConfig(): OverlayConfigType {
  const config = useContext(OverlayConfigContext)
  if (!config) throw new Error('useConfig must be used inside ConfigProvider')
  return config
}
