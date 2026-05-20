import { Suspense } from 'react'
import ChatInterface from '@/features/chat/components/ChatInterface'
import { getSession } from '@/server/auth/workos-auth'
import { getInitialChatHistory } from '@/server/app/route-data'
import { ChatRouteSkeleton } from '../_components/AppRouteSkeletons'

async function ChatRouteContent({
  userId,
  firstName,
}: {
  userId: string | null
  firstName?: string
}) {
  const initialChats = userId ? await getInitialChatHistory() : []
  return (
    <ChatInterface
      userId={userId}
      firstName={firstName}
      initialChats={initialChats}
    />
  )
}

export default async function ChatPage() {
  const session = await getSession()
  return (
    <Suspense fallback={<ChatRouteSkeleton />}>
      <ChatRouteContent
        userId={session?.user.id ?? null}
        firstName={session?.user.firstName ?? undefined}
      />
    </Suspense>
  )
}
