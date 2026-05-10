'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  Activity,
  ArrowLeft,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/security', label: 'Security', icon: Shield },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/health', label: 'Health', icon: Activity },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="flex h-16 items-center border-b border-[var(--border)] px-5">
        <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
          Overlay Admin
        </span>
      </div>

      <nav className="flex-1 overflow-auto p-3">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--foreground)] text-[var(--background)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon size={16} strokeWidth={1.8} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <Link
          href="/app/chat"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Exit Admin
        </Link>
      </div>
    </aside>
  )
}
