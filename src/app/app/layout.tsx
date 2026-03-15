import { redirect } from 'next/navigation'
import { getSession } from '@/lib/workos-auth'
import AppSidebar from '@/components/app/AppSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=/app/chat')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa] text-[#0a0a0a]">
      <AppSidebar user={session.user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
