import { Suspense } from 'react'
import { getOverlaySession } from '@/server/auth/session'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getInitialProjectList } from '@/server/app/route-data'
import { ProjectsRouteSkeleton } from '../_components/AppRouteSkeletons'

const ProjectsView = dynamic(() => import('@/features/projects/components/ProjectsView'), {
  loading: () => <ProjectsRouteSkeleton />,
})

async function ProjectsRouteContent({
  userId,
  firstName,
}: {
  userId: string
  firstName?: string
}) {
  const initialProjects = await getInitialProjectList()
  return <ProjectsView userId={userId} firstName={firstName} initialProjects={initialProjects} />
}

export default async function ProjectsPage() {
  const session = await getOverlaySession()

  if (!session) {
    redirect('/app/chat?signin=nav')
  }
  return (
    <Suspense fallback={<ProjectsRouteSkeleton />}>
      <ProjectsRouteContent userId={session.user.id} firstName={session.user.firstName ?? undefined} />
    </Suspense>
  )
}
