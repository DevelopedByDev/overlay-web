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
      className={`mt-1 text-[10px] leading-snug ${nearLimit ? 'text-amber-600' : 'text-[var(--muted-light)]'}`}
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
    <div className="flex h-full w-48 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
      <div className="hidden min-h-16 shrink-0 flex-col justify-center gap-0 border-b border-[var(--border)] px-4 py-3 md:flex">
        <span className="text-sm font-medium text-[var(--foreground)]">Knowledge</span>
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
                  ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
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
