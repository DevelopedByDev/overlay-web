import { Suspense } from 'react'
import { getOverlaySession } from '@/server/auth/session'
import { getInitialProjectList } from '@/server/app/route-data'
import { ProjectsRouteSkeleton } from '../_components/AppRouteSkeletons'
import ProjectsView from '@/features/projects/components/ProjectsView'

async function ProjectsRouteContent({
  userId,
  firstName,
}: {
  userId: string | null
  firstName?: string
}) {
  const initialProjects = userId ? await getInitialProjectList() : []
  return <ProjectsView userId={userId} firstName={firstName} initialProjects={initialProjects} />
}

export default async function ProjectsPage() {
  const session = await getOverlaySession()
  return (
    <Suspense fallback={<ProjectsRouteSkeleton />}>
      <ProjectsRouteContent
        userId={session?.user.id ?? null}
        firstName={session?.user.firstName ?? undefined}
      />
    </Suspense>
  )
}
