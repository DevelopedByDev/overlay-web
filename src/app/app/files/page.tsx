import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

const KnowledgeView = dynamic(() => import('@/components/app/KnowledgeView'), {
  loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>,
})

export default async function FilesPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>}>
      <KnowledgeView userId={session.user.id} mode="files" />
    </Suspense>
  )
}
