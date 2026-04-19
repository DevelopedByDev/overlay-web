import { getSession } from '@/lib/workos-auth'
import ProjectsView from '@/components/app/ProjectsView'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/app/chat?signin=nav')
  }
  return <ProjectsView userId={session.user.id} firstName={session.user.firstName ?? undefined} />
}
