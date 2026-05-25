import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getOverlaySession } from '@/server/auth/session'
import { getInitialKnowledgeFiles, getInitialKnowledgeMemories } from '@/server/app/route-data'
import { resolveKnowledgeLayout } from '@overlay/app-core'
import { FilesRouteSkeleton, type FilesRouteSkeletonLayout } from '../_components/AppRouteSkeletons'
import { AppAuthRedirect } from '../_components/AppAuthRedirect'

const KnowledgeView = dynamic(() => import('@/features/knowledge/components/KnowledgeView'), {
  loading: () => <FilesRouteSkeleton />,
})

type FilesSearchParams = {
  layout?: string | string[]
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function resolveFilesLayout(params?: FilesSearchParams): FilesRouteSkeletonLayout {
  return resolveKnowledgeLayout({
    layout: firstParam(params?.layout),
    activeTab: 'files',
  })
}

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

export default async function FilesPage({
  searchParams,
}: {
  searchParams?: Promise<FilesSearchParams>
}) {
  const session = await getOverlaySession()
  if (!session) return <AppAuthRedirect />
  const layout = resolveFilesLayout(await searchParams)
  return (
    <Suspense fallback={<FilesRouteSkeleton layout={layout} />}>
      <FilesRouteContent userId={session.user.id} />
    </Suspense>
  )
}
