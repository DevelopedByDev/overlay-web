// @enterprise-future — not wired to production

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    redirect('/app/chat?signin=nav')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
          <h1 className="text-sm font-medium text-[var(--foreground)]">
            Admin
          </h1>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
