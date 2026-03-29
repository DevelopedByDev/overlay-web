import { redirect } from 'next/navigation'
import { getSession } from '@/lib/workos-auth'
import AppSidebar from '@/components/app/AppSidebar'
import { AsyncSessionsProvider } from '@/lib/async-sessions-store'
import BackgroundPollManager from '@/components/app/BackgroundPollManager'
import { NavigationProgressProvider, NavigationProgressBar } from '@/lib/navigation-progress'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=/app/chat')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa] text-[#0a0a0a]">
      <AsyncSessionsProvider>
        <NavigationProgressProvider>
          <NavigationProgressBar />
          <BackgroundPollManager />
          <AppSidebar user={session.user} />
          <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
        </NavigationProgressProvider>
      </AsyncSessionsProvider>
    </div>
  )
}
