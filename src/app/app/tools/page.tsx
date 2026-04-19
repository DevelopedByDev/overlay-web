import ToolsView from '@/components/app/ToolsView'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function ToolsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/app/chat?signin=nav')
  }
  return <ToolsView userId={session.user.id} />
}
