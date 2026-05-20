import { Suspense } from 'react'
import { getOverlaySession } from '@/server/auth/session'
import ChatInterface from '@/features/chat/components/ChatInterface'
import { getInitialChatHistory } from '@/server/app/route-data'
import { ChatRouteSkeleton } from '../_components/AppRouteSkeletons'

async function AutomationsRouteContent({
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
      mode="automate"
      initialChats={initialChats}
    />
  )
}

export default async function AutomationsPage() {
  const session = await getOverlaySession()
  return (
    <Suspense fallback={<ChatRouteSkeleton mode="automate" />}>
      <AutomationsRouteContent
        userId={session?.user.id ?? null}
        firstName={session?.user.firstName ?? undefined}
      />
    </Suspense>
  )
}
