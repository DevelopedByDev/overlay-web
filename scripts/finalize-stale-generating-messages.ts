import { callConvex, getInternalApiSecret, loadLocalEnv, readArg, resolveTargets } from './convex-admin-utils.ts'

type FinalizeResult = {
  finalizedCount: number
  remaining: number
}

async function main() {
  loadLocalEnv()
  const secret = getInternalApiSecret()
  const envArg = readArg('env', 'both')
  const targets = resolveTargets(envArg)
  const cutoffArg = readArg('cutoffMinutes')
  const cutoffMinutes = cutoffArg ? Number(cutoffArg) : undefined
  const limitArg = readArg('limit')
  const limit = limitArg ? Number(limitArg) : undefined

  for (const target of targets) {
    const result = await callConvex<FinalizeResult>(
      target,
      'mutation',
      'conversations:finalizeStaleGeneratingMessages',
      {
        serverSecret: secret,
        ...(cutoffMinutes !== undefined ? { cutoffMinutes } : {}),
        ...(limit !== undefined ? { limit } : {}),
      },
    )
    console.log(`\n[${target.toUpperCase()}] Finalized ${result.finalizedCount} stale generating message(s) (remaining: ${result.remaining})`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
