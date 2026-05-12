import type { ReactNode } from 'react'
import { getConfig } from './singleton'
import { ClientConfigProvider } from './ClientConfigProvider'

export function ConfigProvider({ children }: { children: ReactNode }) {
  return (
    <ClientConfigProvider config={getConfig()}>
      {children}
    </ClientConfigProvider>
  )
}
