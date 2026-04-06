'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Brain, FileText, Images } from 'lucide-react'
import { formatBytes } from '@/lib/storage-limits'

type KnowledgeView = 'memories' | 'files' | 'outputs'

const NAV_ITEMS: { id: KnowledgeView; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'memories', label: 'Memories', icon: Brain },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'outputs', label: 'Outputs', icon: Images },
]

type StorageEntitlements = {
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
}

function StorageUsageCaption({ entitlements }: { entitlements: StorageEntitlements | null }) {
  if (!entitlements) return null
  const used = Math.max(0, entitlements.overlayStorageBytesUsed ?? 0)
  const limit = Math.max(0, entitlements.overlayStorageBytesLimit ?? 0)
  if (limit <= 0) return null
  const nearLimit = used / limit >= 0.85
  return (
    <div
      className={`mt-1 text-[10px] leading-snug ${nearLimit ? 'text-[#b45309]' : 'text-[#9a9a9a]'}`}
    >
      {formatBytes(used)} / {formatBytes(limit)}
    </div>
  )
}

export default function KnowledgeSidebar({
  entitlements,
}: {
  entitlements: StorageEntitlements | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams?.get('view') ?? 'memories'
  const activeView: KnowledgeView =
    view === 'files' ? 'files' : view === 'outputs' ? 'outputs' : 'memories'

  function pushView(next: KnowledgeView) {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    p.set('view', next)
    if (next !== 'outputs') p.delete('out')
    router.push(`/app/knowledge?${p.toString()}`)
  }

  return (
    <div className="flex h-full w-48 shrink-0 flex-col border-r border-[#e5e5e5] bg-[#f5f5f5]">
      <div className="hidden min-h-16 shrink-0 flex-col justify-center gap-0 border-b border-[#e5e5e5] px-4 py-3 md:flex">
        <span className="text-sm font-medium text-[#0a0a0a]">Knowledge</span>
        <StorageUsageCaption entitlements={entitlements} />
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => pushView(id)}
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
