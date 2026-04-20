import IntegrationsView from '@/components/app/IntegrationsView'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return <IntegrationsView userId={session.user.id} />
}
