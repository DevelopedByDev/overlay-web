'use client'

import { useSearchParams } from 'next/navigation'
import { Wrench, Sparkles } from 'lucide-react'
import IntegrationsView from './IntegrationsView'

function SkillsPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-[#e5e5e5] px-6">
        <h2 className="text-sm font-medium text-[#0a0a0a]">Skills</h2>
      </div>
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-[#888]">
        <Sparkles size={40} strokeWidth={1} className="opacity-30" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-[#525252]">Skills coming soon</p>
          <p className="text-xs text-[#aaa]">Create reusable AI skills to use across your workspace</p>
        </div>
      </div>
    </div>
  )
}

export default function ToolsView({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  if (view === 'skills') {
    return <SkillsPlaceholder />
  }

  if (view && view !== 'connectors') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
        <Wrench size={40} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Unknown tools view</p>
      </div>
    )
  }

  return <IntegrationsView userId={userId} />
}
