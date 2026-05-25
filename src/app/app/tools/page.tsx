import { getOverlaySession } from '@/server/auth/session'
import { AppAuthRedirect } from '../_components/AppAuthRedirect'
import ToolsView from '@/features/tools/components/ToolsView'

export default async function ToolsPage() {
  const session = await getOverlaySession()
  if (!session) {
    return <AppAuthRedirect />
  }
  return <ToolsView userId={session.user.id} />
}
