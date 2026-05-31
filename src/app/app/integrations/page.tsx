import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { getOverlaySession } from '@/server/auth/session'
import { redirect } from 'next/navigation'
import { getInitialIntegrationsData } from '@/server/app/route-data'
import { IntegrationsRouteSkeleton } from '../_components/AppRouteSkeletons'

const IntegrationsView = dynamic(() => import('@/features/integrations/components/IntegrationsView'), {
  loading: () => <IntegrationsRouteSkeleton />,
})

async function IntegrationsRouteContent({ userId }: { userId: string }) {
  const initialData = await getInitialIntegrationsData()
  return <IntegrationsView userId={userId} initialData={initialData} />
}

export default async function IntegrationsPage() {
  const session = await getOverlaySession()

  if (!session) redirect('/app/chat?signin=nav')
  return (
    <Suspense fallback={<IntegrationsRouteSkeleton />}>
      <IntegrationsRouteContent userId={session.user.id} />
    </Suspense>
  )
}
