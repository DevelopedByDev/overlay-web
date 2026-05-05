import { Suspense } from 'react'
import KnowledgeView from '@/components/app/KnowledgeView'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/app/chat?signin=nav')
  const params = await searchParams
  const rawView = params?.view
  const view = Array.isArray(rawView) ? rawView[0] : rawView
  const rawFile = params?.file
  const file = Array.isArray(rawFile) ? rawFile[0] : rawFile
  const rawMemory = params?.memory
  const memory = Array.isArray(rawMemory) ? rawMemory[0] : rawMemory
  if (file) redirect(`/app/files?file=${encodeURIComponent(file)}`)
  if (memory) redirect('/app/settings?section=memories')
  if (view === 'files') redirect('/app/files')
  if (view === 'outputs') redirect('/app/files?view=outputs')
  if (!view || view === 'memories') redirect('/app/settings?section=memories')
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-[#888]">Loading...</div>}>
      <KnowledgeView userId={session.user.id} />
    </Suspense>
  )
}
