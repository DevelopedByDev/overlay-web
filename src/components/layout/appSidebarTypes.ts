import type { ReactNode } from 'react'
import type { AuthUser } from '@/shared/auth/session-types'

export interface AppSidebarNavigateContext {
  onNavigate: () => void
}

export interface AppSidebarChatPanelContext extends AppSidebarNavigateContext {
  refreshKey: number
}

export interface AppSidebarProps {
  user: AuthUser | null
  /** Injected from app shell — keeps chat feature UI out of shared layout code. */
  renderChatPanel?: (context: AppSidebarChatPanelContext) => ReactNode
  /** Injected from app shell — keeps automations feature UI out of shared layout code. */
  renderAutomationsPanel?: (context: AppSidebarNavigateContext) => ReactNode
}
