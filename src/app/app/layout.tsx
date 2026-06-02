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
import { AppConfigurationErrorState } from './_components/AppConfigurationErrorState'
import { AppShellLoadingFallback, ChatRouteSkeleton } from './_components/AppRouteSkeletons'

function AppMainFallback() {
  return <ChatRouteSkeleton />
}

async function AppLayoutContent({ children }: { children: React.ReactNode }) {
  let session: Awaited<ReturnType<typeof getOverlaySession>>
  let capabilities: ReturnType<typeof getOverlayCapabilitiesSync>
  try {
    session = await getOverlaySession()
    capabilities = getOverlayCapabilitiesSync()
  } catch (error) {
    return <AppConfigurationErrorState error={error} />
  }

  const user = session?.user ?? null
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellLoadingFallback />}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  )
}
