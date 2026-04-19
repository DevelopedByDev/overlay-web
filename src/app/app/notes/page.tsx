import NotebookEditor from '@/components/app/NotebookEditor'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function NotesPage() {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  return <NotebookEditor userId={session.user.id} />
}
