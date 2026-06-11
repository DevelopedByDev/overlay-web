'use client'

import AppSidebar from '@/components/layout/AppSidebar'
import { ChatInlinePanel } from '@/features/chat/components/ChatInlinePanel'
import { AutomationsInlinePanel } from '@/features/automations/components/AutomationsInlinePanel'
import type { AuthUser } from '@/shared/auth/session-types'

export function AppShellSidebar({ user }: { user: AuthUser | null }) {
  return (
    <AppSidebar
      user={user}
      renderChatPanel={({ refreshKey, onNavigate }) => (
        <ChatInlinePanel
          refreshKey={refreshKey}
          searchQuery=""
          onNavigate={onNavigate}
        />
      )}
      renderAutomationsPanel={({ onNavigate }) => (
        <AutomationsInlinePanel onNavigate={onNavigate} />
      )}
    />
  )
}
