import ChatInterface from '@/components/app/ChatInterface'
import { getSession } from '@/lib/workos-auth'

export default async function ChatPage() {
  const session = await getSession()
  return (
    <ChatInterface userId={session!.user.id} firstName={session!.user.firstName ?? undefined} />
  )
}
