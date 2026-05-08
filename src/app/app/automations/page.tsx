import dynamic from 'next/dynamic'
import { getSession } from '@/lib/workos-auth'

const ChatInterface = dynamic(() => import('@/components/app/ChatInterface'))

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
