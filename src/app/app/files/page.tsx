import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getSession } from '@/server/auth/workos-auth'
import { getInitialKnowledgeFiles, getInitialKnowledgeMemories } from '@/server/app/route-data'
import { redirect } from 'next/navigation'
import { KnowledgeRouteSkeleton } from '../_components/AppRouteSkeletons'

const KnowledgeView = dynamic(() => import('@/features/knowledge/components/KnowledgeView'), {
  loading: () => <KnowledgeRouteSkeleton />,
})

async function FilesRouteContent({ userId }: { userId: string }) {
  const [initialFiles, initialMemories] = await Promise.all([
    getInitialKnowledgeFiles(),
    getInitialKnowledgeMemories(),
  ])

  return (
    <KnowledgeView
      userId={userId}
      mode="files"
      initialFiles={initialFiles}
      initialMemories={initialMemories}
    />
  )
}

export default async function FilesPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return (
    <Suspense fallback={<KnowledgeRouteSkeleton />}>
      <FilesRouteContent userId={session.user.id} />
    </Suspense>
  )
}
