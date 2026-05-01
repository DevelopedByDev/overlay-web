import ChatInterface from '@/components/app/ChatInterface'
import { getSession } from '@/lib/workos-auth'

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
