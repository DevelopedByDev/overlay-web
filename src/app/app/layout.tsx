import { getOverlaySession } from '@/server/auth/session'
import AppSidebar from '@/components/layout/AppSidebar'
import { AsyncSessionsProvider } from '@/components/providers/async-sessions-store'
import BackgroundPollManager from '@/components/providers/BackgroundPollManager'
import { NavigationProgressProvider, NavigationProgressBar } from '@/components/providers/navigation-progress'
import { GuestGateProvider } from '@/components/providers/GuestGateProvider'
import { OnboardingProvider } from '@/components/providers/OnboardingProvider'
import { getInitialAutomationsList, getInitialProjectList } from '@/server/app/route-data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getOverlaySession()
  const user = session?.user ?? null
  const [initialProjects, initialAutomations] = user
    ? await Promise.all([
        getInitialProjectList(),
        getInitialAutomationsList(),
      ])
    : [undefined, undefined]

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AsyncSessionsProvider>
        <NavigationProgressProvider>
          <NavigationProgressBar />
          {user && <BackgroundPollManager />}
          <GuestGateProvider>
            <OnboardingProvider>
              <AppSidebar
                user={user}
                initialProjects={initialProjects}
                initialAutomations={initialAutomations}
              />
              <main className="flex-1 overflow-auto pt-14 md:pt-0">
                {children}
              </main>
            </OnboardingProvider>
          </GuestGateProvider>
        </NavigationProgressProvider>
      </AsyncSessionsProvider>
    </div>
  )
}
