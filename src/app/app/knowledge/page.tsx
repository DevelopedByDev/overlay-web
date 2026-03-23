import { Suspense } from 'react'
import KnowledgeView from '@/components/app/KnowledgeView'
import { getSession } from '@/lib/workos-auth'

export default async function KnowledgePage() {
  const session = await getSession()
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading…</div>}>
      <KnowledgeView userId={session!.user.id} />
    </Suspense>
  )
}
