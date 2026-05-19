'use client'

// Compatibility wrapper: extension registry metadata is canonical in @overlay/app-core,
// with transport in @overlay/api-client and reusable presentation in @overlay/modules-react.
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AllExtensionsComingSoonView, AppsComingSoonView } from '@overlay/modules-react/extensions'

const IntegrationsView = dynamic(() => import('@/features/integrations/components/IntegrationsView'))
const SkillsView = dynamic(() => import('@/features/automations/components/SkillsView'))
const McpServersView = dynamic(() => import('@/features/integrations/components/McpServersView'))

export default function ToolsView({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const view = searchParams?.get('view') ?? null

  if (view === 'skills') return <SkillsView userId={userId} />
  if (view === 'mcps') return <McpServersView userId={userId} />
  if (view === 'apps') return <AppsComingSoonView />
  if (view === 'all') return <AllExtensionsComingSoonView />

  return <IntegrationsView userId={userId} />
}
