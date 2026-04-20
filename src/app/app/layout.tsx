import { Suspense } from 'react'
import { getSession } from '@/lib/workos-auth'
import AppSidebar from '@/components/app/AppSidebar'
import { AsyncSessionsProvider } from '@/lib/async-sessions-store'
import BackgroundPollManager from '@/components/app/BackgroundPollManager'
import { NavigationProgressProvider, NavigationProgressBar } from '@/lib/navigation-progress'
import { GuestGateProvider } from '@/components/app/GuestGateProvider'
import { OnboardingProvider } from '@/components/app/OnboardingProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const user = session?.user ?? null

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AsyncSessionsProvider>
        <NavigationProgressProvider>
          <NavigationProgressBar />
          {user && <BackgroundPollManager />}
          <Suspense fallback={null}>
            <GuestGateProvider>
              <OnboardingProvider>
                <AppSidebar user={user} />
                <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
              </OnboardingProvider>
            </GuestGateProvider>
          </Suspense>
        </NavigationProgressProvider>
      </AsyncSessionsProvider>
    </div>
  )
}
