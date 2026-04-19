import MemoriesView from '@/components/app/MemoriesView'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function MemoriesPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return <MemoriesView userId={session.user.id} />
}
