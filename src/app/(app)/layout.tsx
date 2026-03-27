import { redirect } from 'next/navigation'
import { getSession } from '@/lib/workos-auth'
import AppSidebar from '@/components/app/AppSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=/app/chat')
  }

  return (
    <div className="flex h-screen bg-[#fafafa] text-[#0a0a0a] overflow-hidden">
      <AppSidebar user={session.user} accessToken={session.accessToken} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
