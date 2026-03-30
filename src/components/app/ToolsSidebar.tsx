'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, Plug, Sparkles, Server, Package, CheckSquare, Lock } from 'lucide-react'

type ExtView = 'all' | 'connectors' | 'skills' | 'mcps' | 'apps' | 'installed'

const NAV_ITEMS: { id: ExtView; label: string; icon: React.ComponentType<{ size?: number }>; locked?: boolean }[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'mcps', label: 'MCPs', icon: Server },
  { id: 'apps', label: 'Apps', icon: Package, locked: true },
  { id: 'installed', label: 'Installed', icon: CheckSquare },
]

export default function ToolsSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = searchParams?.get('view')

  const activeView: ExtView = (() => {
    if (currentView === 'skills') return 'skills'
    if (currentView === 'mcps') return 'mcps'
    if (currentView === 'apps') return 'apps'
    if (currentView === 'installed') return 'installed'
    if (currentView === 'all') return 'all'
    return 'connectors'
  })()

  return (
    <div className="w-48 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
      <div className="hidden h-16 items-center border-b border-[#e5e5e5] px-4 md:flex shrink-0">
        <span className="text-sm font-medium text-[#0a0a0a]">Extensions</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon, locked }) => {
          const active = !locked && activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => { if (!locked) router.push(`/app/tools?view=${id}`) }}
              className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                locked
                  ? 'cursor-default text-[#bbb]'
                  : active
                    ? 'bg-[#0a0a0a] text-[#fafafa]'
                    : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
              }`}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
              {locked && <Lock size={11} className="shrink-0 text-[#ccc]" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
