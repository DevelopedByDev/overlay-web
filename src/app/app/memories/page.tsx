import MemoriesView from '@/components/app/MemoriesView'
import { getSession } from '@/lib/workos-auth'

export default async function MemoriesPage() {
  const session = await getSession()
  return <MemoriesView userId={session!.user.id} />
}
