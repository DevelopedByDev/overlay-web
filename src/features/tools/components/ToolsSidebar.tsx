'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, Plug, Sparkles, Server, Package, Lock } from 'lucide-react'

type ExtView = 'all' | 'connectors' | 'skills' | 'mcps' | 'apps'

const NAV_ITEMS: { id: ExtView; label: string; icon: React.ComponentType<{ size?: number }>; locked?: boolean }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'mcps', label: 'MCPs', icon: Server },
  { id: 'apps', label: 'Apps', icon: Package, locked: true },
]

export default function ToolsSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = searchParams?.get('view')

  const activeView: ExtView = (() => {
    if (currentView === 'skills') return 'skills'
    if (currentView === 'mcps') return 'mcps'
    if (currentView === 'apps') return 'apps'
    if (currentView === 'all') return 'all'
    return 'connectors'
  })()

  return (
    <div className="flex h-full w-48 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
      <div className="hidden h-16 shrink-0 items-center border-b border-[var(--border)] px-4 md:flex">
        <span className="font-serif text-sm font-medium text-[var(--foreground)]">Extensions</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3 font-serif">
        {NAV_ITEMS.map(({ id, label, icon: Icon, locked }) => {
          const active = !locked && activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => { if (!locked) router.push(`/app/tools?view=${id}`) }}
              className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                locked
                  ? 'cursor-default text-[var(--muted-light)]'
                  : active
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
              {locked && <Lock size={11} className="shrink-0 text-[var(--muted-light)]" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
