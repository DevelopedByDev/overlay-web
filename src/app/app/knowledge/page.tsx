import { Suspense } from 'react'
import KnowledgeView from '@/components/app/KnowledgeView'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function KnowledgePage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading…</div>}>
      <KnowledgeView userId={session.user.id} />
    </Suspense>
  )
}
