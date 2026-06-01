import { Suspense } from 'react'
import ChatSuspenseBoundary from '@/features/chat/components/ChatSuspenseBoundary'
import { getOverlaySession } from '@/server/auth/session'
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
    <ChatSuspenseBoundary
      userId={userId}
      firstName={firstName}
      initialChats={initialChats}
    />
  )
}

export default async function ChatPage() {
  const session = await getOverlaySession()

  return (
    <Suspense fallback={<ChatRouteSkeleton />}>
      <ChatRouteContent
        userId={session?.user.id ?? null}
        firstName={session?.user.firstName ?? undefined}
      />
    </Suspense>
  )
}
