'use client'

import { Suspense, type ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AuthProvider, type AuthUser } from '@/contexts/AuthContext'
import ObservabilityClient from '@/components/providers/ObservabilityClient'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'
import { ConvexProviderWithWorkOS } from '@/components/providers/ConvexProviderWithWorkOS'

export function AppClientProviders({
  children,
  initialUser,
}: {
  children: ReactNode
  initialUser: AuthUser | null
}) {
  return (
    <AppSettingsProvider>
      <AuthProvider initialUser={initialUser} initialSessionResolved>
        <ConvexProviderWithWorkOS>
          <Suspense fallback={null}>
            <ObservabilityClient />
          </Suspense>
          {children}
          <Analytics />
          <SpeedInsights />
        </ConvexProviderWithWorkOS>
      </AuthProvider>
    </AppSettingsProvider>
  )
}
