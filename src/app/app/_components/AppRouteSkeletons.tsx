function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`ui-skeleton-line rounded-md ${className}`} aria-hidden />
}

function SidebarRows({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-2 py-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <SkeletonBlock className="h-4 w-4 shrink-0 rounded" />
          <SkeletonBlock className={`h-3 ${index % 3 === 0 ? 'w-28' : index % 3 === 1 ? 'w-36' : 'w-24'}`} />
        </div>
      ))}
    </div>
  )
}

function PageHeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <SkeletonBlock key={index} className="h-8 w-8 rounded-md" />
        ))}
      </div>
    </div>
  )
}

export function ChatRouteSkeleton({ mode = 'chat' }: { mode?: 'chat' | 'automate' }) {
  return (
    <div className="flex h-full min-w-0 overflow-hidden bg-[var(--background)]">
      <div className="hidden h-full w-52 shrink-0 border-r border-[var(--border)] bg-[var(--surface-muted)] md:block">
        <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
          <SkeletonBlock className="h-8 w-full rounded-md" />
        </div>
        <SidebarRows rows={mode === 'automate' ? 5 : 8} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeaderSkeleton actions={mode === 'automate' ? 1 : 3} />
        <div className="flex min-h-0 flex-1 flex-col justify-between px-4 py-5">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            <SkeletonBlock className="h-3 w-24" />
            <div className="space-y-2.5">
              <SkeletonBlock className="h-3 w-[72%]" />
              <SkeletonBlock className="h-3 w-[86%]" />
              <SkeletonBlock className="h-3 w-[48%]" />
            </div>
            <div className="ml-auto w-[72%] space-y-2.5">
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-[68%]" />
            </div>
          </div>
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
            <SkeletonBlock className="mb-3 h-4 w-40" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <SkeletonBlock className="h-8 w-8 rounded-md" />
                <SkeletonBlock className="h-8 w-8 rounded-md" />
              </div>
              <SkeletonBlock className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function KnowledgeRouteSkeleton() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <PageHeaderSkeleton actions={3} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-2">
            <SkeletonBlock className="h-8 w-20 rounded-md" />
            <SkeletonBlock className="h-8 w-20 rounded-md" />
          </div>
          <SkeletonBlock className="h-8 w-36 rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
              <SkeletonBlock className="mb-3 h-5 w-5 rounded" />
              <SkeletonBlock className="mb-2 h-3 w-32" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProjectsRouteSkeleton() {
  return (
    <div className="flex h-full bg-[var(--background)]">
      <div className="hidden h-full w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface-muted)] md:block">
        <PageHeaderSkeleton actions={1} />
        <SidebarRows rows={7} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeaderSkeleton actions={2} />
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <SkeletonBlock className="mb-3 h-4 w-36" />
              <SkeletonBlock className="mb-2 h-3 w-full" />
              <SkeletonBlock className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsRouteSkeleton() {
  return (
    <div className="flex h-full bg-[var(--background)]">
      <div className="hidden h-full w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface-muted)] p-3 md:block">
        <SidebarRows rows={6} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeaderSkeleton actions={0} />
        <div className="mx-auto w-full max-w-3xl space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <SkeletonBlock className="mb-3 h-4 w-44" />
              <SkeletonBlock className="mb-2 h-3 w-full" />
              <SkeletonBlock className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function IntegrationsRouteSkeleton() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <PageHeaderSkeleton actions={1} />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-6">
        <SkeletonBlock className="h-3 w-24" />
        <SidebarRows rows={4} />
        <SkeletonBlock className="h-3 w-24" />
        <SidebarRows rows={6} />
      </div>
    </div>
  )
}
