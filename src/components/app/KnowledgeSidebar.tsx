'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Brain, FileText } from 'lucide-react'

type KnowledgeView = 'memories' | 'files'

const NAV_ITEMS: { id: KnowledgeView; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'memories', label: 'Memories', icon: Brain },
  { id: 'files', label: 'Files', icon: FileText },
]

export default function KnowledgeSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeView: KnowledgeView = searchParams?.get('view') === 'files' ? 'files' : 'memories'

  return (
    <div className="w-48 h-full flex flex-col border-r border-[#e5e5e5] bg-[#f5f5f5] shrink-0">
      <div className="hidden h-16 items-center border-b border-[#e5e5e5] px-4 md:flex shrink-0">
        <span className="text-sm font-medium text-[#0a0a0a]">Knowledge</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => router.push(`/app/knowledge?view=${id}`)}
              className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'
              }`}
            >
              <Icon size={15} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
