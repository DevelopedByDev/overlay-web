import { Suspense } from 'react'
import { getSession } from '@/lib/workos-auth'
import AppSidebar from '@/components/app/AppSidebar'
import { AsyncSessionsProvider } from '@/lib/async-sessions-store'
import BackgroundPollManager from '@/components/app/BackgroundPollManager'
import { NavigationProgressProvider, NavigationProgressBar } from '@/lib/navigation-progress'
import { GuestGateProvider } from '@/components/app/GuestGateProvider'
import { OnboardingProvider } from '@/components/app/OnboardingProvider'

function AppMainFallback() {
  return (
    <div className="flex min-h-full flex-col overflow-hidden bg-[var(--background)]">
      <div className="h-16 shrink-0 border-b border-[var(--border)]" />
      <div className="flex min-h-0 flex-1 flex-col justify-end px-4 pb-4">
        <div className="mx-auto h-24 w-full max-w-[56rem] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]" />
      </div>
    </div>
  )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const user = session?.user ?? null

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AsyncSessionsProvider>
        <NavigationProgressProvider>
          <NavigationProgressBar />
          {user && <BackgroundPollManager />}
          <GuestGateProvider>
            <OnboardingProvider>
              <AppSidebar user={user} />
              <main className="flex-1 overflow-auto pt-14 md:pt-0">
                <Suspense fallback={<AppMainFallback />}>{children}</Suspense>
              </main>
            </OnboardingProvider>
          </GuestGateProvider>
        </NavigationProgressProvider>
      </AsyncSessionsProvider>
    </div>
  )
}
