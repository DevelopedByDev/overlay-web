'use client'

import { useSearchParams } from 'next/navigation'
import { Plug, Lock, LayoutGrid, CheckSquare } from 'lucide-react'
import IntegrationsView from './IntegrationsView'
import SkillsView from './SkillsView'

function ComingSoonView({ title, icon: Icon }: {
  title: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-6">
        <h2 className="text-sm font-medium text-[#0a0a0a]">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-[#888]">
        <Icon size={40} strokeWidth={1} className="opacity-30" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-[#525252]">{title} coming soon</p>
          <p className="text-xs text-[#aaa]">This feature is under development</p>
        </div>
      </div>
    </div>
  )
}

export default function ToolsView({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const view = searchParams?.get('view') ?? null

  if (view === 'skills') return <SkillsView userId={userId} />
  if (view === 'mcps') return <ComingSoonView title="MCP Servers" icon={Plug} />
  if (view === 'apps') return <ComingSoonView title="Apps" icon={Lock} />
  if (view === 'all') return <ComingSoonView title="All Extensions" icon={LayoutGrid} />
  if (view === 'installed') return <ComingSoonView title="Installed" icon={CheckSquare} />

  return <IntegrationsView userId={userId} />
}
