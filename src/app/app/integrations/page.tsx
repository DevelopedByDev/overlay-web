import dynamic from 'next/dynamic'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

const IntegrationsView = dynamic(() => import('@/components/app/IntegrationsView'), {
  loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>,
})

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return <IntegrationsView userId={session.user.id} />
}
