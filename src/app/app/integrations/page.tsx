import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getOverlaySession } from '@/server/auth/session'
import { redirect } from 'next/navigation'
import { getInitialIntegrationsData } from '@/server/app/route-data'
import { IntegrationsRouteSkeleton } from '../_components/AppRouteSkeletons'

const IntegrationsView = dynamic(() => import('@/features/integrations/components/IntegrationsView'), {
  loading: () => <IntegrationsRouteSkeleton />,
})

type IntegrationsSearchParams = {
  projectId?: string | string[]
}

function readProjectId(params?: IntegrationsSearchParams): string | undefined {
  const value = params?.projectId
  return Array.isArray(value) ? value[0] : value
}

async function IntegrationsRouteContent({ userId, projectId }: { userId: string; projectId?: string }) {
  const initialData = await getInitialIntegrationsData(projectId)
  return <IntegrationsView userId={userId} initialData={initialData} />
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<IntegrationsSearchParams>
}) {
  const session = await getOverlaySession()
  if (!session) redirect('/app/chat?signin=nav')
  const projectId = readProjectId(await searchParams)
  return (
    <Suspense fallback={<IntegrationsRouteSkeleton />}>
      <IntegrationsRouteContent userId={session.user.id} projectId={projectId} />
    </Suspense>
  )
}
