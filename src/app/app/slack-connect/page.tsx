import { getSession } from '@/lib/workos-auth'
import SlackConnect from '@/components/app/SlackConnect'

export default async function SlackConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ slackUserId?: string; teamId?: string; state?: string }>
}) {
  const session = await getSession()
  const params = await searchParams

  return (
    <SlackConnect
      user={session!.user}
      slackUserId={params.slackUserId}
      teamId={params.teamId}
    />
  )
}
