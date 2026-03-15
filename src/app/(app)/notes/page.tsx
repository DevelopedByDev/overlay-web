import NotebookEditor from '@/components/app/NotebookEditor'
import { getSession } from '@/lib/workos-auth'

export default async function NotesPage() {
  const session = await getSession()
  return <NotebookEditor userId={session!.user.id} />
}
