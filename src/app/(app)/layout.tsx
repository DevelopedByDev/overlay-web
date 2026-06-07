import { AppClientProviders } from '@/components/providers/AppClientProviders'
import { getOverlaySession } from '@/server/auth/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getOverlaySession()
  return <AppClientProviders initialUser={session?.user ?? null}>{children}</AppClientProviders>
}
