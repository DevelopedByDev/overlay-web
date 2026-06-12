'use client'

import AppSidebar from '@/components/layout/AppSidebar'
import { ChatInlinePanel } from '@/features/chat/components/ChatInlinePanel'
import { AutomationsInlinePanel } from '@/features/automations/components/AutomationsInlinePanel'

export function AppShellSidebar() {
  return (
    <AppSidebar
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
