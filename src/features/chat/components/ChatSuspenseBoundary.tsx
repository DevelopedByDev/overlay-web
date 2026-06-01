import { Suspense, type ReactNode } from 'react'
import ChatExperience from './ChatExperience'
import type { CachedConversation } from '@/shared/chat/chat-list-cache'

type ChatInterfaceProps = {
  userId: string | null
  firstName?: string
  hideSidebar?: boolean
  projectName?: string
  mode?: 'chat' | 'automate'
  hideHeader?: boolean
  belowEmptyComposer?: ReactNode
  initialChats?: CachedConversation[]
}

function ChatSuspenseFallback() {
  return (
    <div className="flex h-full min-h-0 w-full items-start justify-center px-4 py-6">
      <div className="w-full max-w-4xl space-y-4" aria-hidden>
        <div className="tool-line-shimmer h-4 w-36 rounded" />
        <div className="space-y-2.5">
          <div className="ui-skeleton-line h-3 w-[min(72%,34rem)]" />
          <div className="ui-skeleton-line h-3 w-[min(88%,42rem)]" />
          <div className="ui-skeleton-line h-3 w-[min(54%,26rem)]" />
        </div>
      </div>
    </div>
  )
}

export default function ChatSuspenseBoundary(props: ChatInterfaceProps) {
  return (
    <Suspense fallback={<ChatSuspenseFallback />}>
      <ChatExperience {...props} />
    </Suspense>
  )
}
