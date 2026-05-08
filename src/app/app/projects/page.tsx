import { getSession } from '@/lib/workos-auth'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'

const ProjectsView = dynamic(() => import('@/components/app/ProjectsView'), {
  loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>,
})

export default async function ProjectsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/app/chat?signin=nav')
  }
  return <ProjectsView userId={session.user.id} firstName={session.user.firstName ?? undefined} />
}
