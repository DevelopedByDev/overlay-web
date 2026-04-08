'use client'

import { useSearchParams } from 'next/navigation'
import { Plug, Lock, LayoutGrid } from 'lucide-react'
import IntegrationsView from './IntegrationsView'
import SkillsView from './SkillsView'

function ComingSoonView({ title, icon: Icon }: {
  title: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-[var(--muted)]">
        <Icon size={40} strokeWidth={1} className="text-[var(--muted-light)] opacity-80" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">{title} coming soon</p>
          <p className="text-xs text-[var(--muted-light)]">This feature is under development</p>
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

  return <IntegrationsView userId={userId} />
}
