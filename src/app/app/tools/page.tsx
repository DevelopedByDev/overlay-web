import dynamic from 'next/dynamic'
import { getOverlaySession } from '@/server/auth/session'
import { redirect } from 'next/navigation'

const ToolsView = dynamic(() => import('@/features/tools/components/ToolsView'), {
  loading: () => <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>,
})

export default async function ToolsPage() {
  const session = await getOverlaySession()

  if (!session) {
    redirect('/app/chat?signin=nav')
  }
  return <ToolsView userId={session.user.id} />
}
