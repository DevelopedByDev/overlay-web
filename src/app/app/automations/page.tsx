import dynamic from 'next/dynamic'
import { getSession } from '@/server/auth/workos-auth'

const ChatInterface = dynamic(() => import('@/features/chat/components/ChatInterface'))

export default async function AutomationsPage() {
  const session = await getSession()
  return (
    <ChatInterface
      userId={session?.user.id ?? null}
      firstName={session?.user.firstName ?? undefined}
      mode="automate"
    />
  )
}
