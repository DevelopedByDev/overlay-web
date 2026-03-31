import { Suspense } from 'react'
import OutputsView from '@/components/app/OutputsView'

export default function OutputsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading…</div>}>
      <OutputsView />
    </Suspense>
  )
}
