import { redirect } from 'next/navigation'
import AutomationsView from '@/components/app/AutomationsView'
import { getSession } from '@/lib/workos-auth'

export default async function AutomationsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=%2Fapp%2Fautomations')
  }
  return <AutomationsView userId={session.user.id} />
}
