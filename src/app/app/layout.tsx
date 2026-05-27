import { Suspense } from 'react'
import { getOverlaySession } from '@/server/auth/session'
import AppSidebar from '@/components/layout/AppSidebar'
import { AsyncSessionsProvider } from '@/components/providers/async-sessions-store'
import BackgroundPollManager from '@/components/providers/BackgroundPollManager'
import { NavigationProgressProvider, NavigationProgressBar } from '@/components/providers/navigation-progress'
import { GuestGateProvider } from '@/components/providers/GuestGateProvider'
import { OnboardingProvider } from '@/components/providers/OnboardingProvider'
import { CapabilitiesProvider } from '@/components/providers/CapabilitiesProvider'
import { getInitialAutomationsList, getInitialProjectList } from '@/server/app/route-data'
import { getOverlayCapabilitiesSync } from '@/server/capabilities'

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
  const session = await getOverlaySession()
  const user = session?.user ?? null
  const capabilities = getOverlayCapabilitiesSync()
  const [initialProjects, initialAutomations] = user
    ? await Promise.all([
        getInitialProjectList(),
        capabilities.automations ? getInitialAutomationsList() : Promise.resolve(undefined),
      ])
    : [undefined, undefined]

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AsyncSessionsProvider>
        <NavigationProgressProvider>
          <NavigationProgressBar />
          {user && <BackgroundPollManager />}
          <CapabilitiesProvider initialCapabilities={capabilities}>
            <GuestGateProvider>
              <OnboardingProvider>
                <AppSidebar
                  user={user}
                  initialProjects={initialProjects}
                  initialAutomations={initialAutomations}
                />
                <main className="flex-1 overflow-auto pt-14 md:pt-0">
                  <Suspense fallback={<AppMainFallback />}>{children}</Suspense>
                </main>
              </OnboardingProvider>
            </GuestGateProvider>
          </CapabilitiesProvider>
        </NavigationProgressProvider>
      </AsyncSessionsProvider>
    </div>
  )
}
