import ChatInterface from '@/features/chat/components/ChatInterface'
import { getSession } from '@/server/auth/workos-auth'

export default async function ChatPage() {
  const session = await getSession()
  return (
    <ChatInterface
      userId={session?.user.id ?? null}
      firstName={session?.user.firstName ?? undefined}
    />
  )
}
