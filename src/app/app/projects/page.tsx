import { getSession } from '@/lib/workos-auth'
import ProjectsView from '@/components/app/ProjectsView'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=%2Fapp%2Fprojects')
  }
  return <ProjectsView userId={session.user.id} firstName={session.user.firstName ?? undefined} />
}
