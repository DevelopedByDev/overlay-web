import AgentChat from '@/components/app/AgentChat'
import { getSession } from '@/lib/workos-auth'

export default async function AgentPage() {
  await getSession()
  return <AgentChat />
}
