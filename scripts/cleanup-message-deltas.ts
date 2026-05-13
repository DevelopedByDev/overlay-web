import { callConvex, getInternalApiSecret, loadLocalEnv, readArg, resolveTargets } from './convex-admin-utils.ts'

type CleanupResult = {
  deleted: number
  scanned: number
  mode: 'age' | 'orphan' | 'inactive'
}

async function main() {
  loadLocalEnv()
  const secret = getInternalApiSecret()
  const envArg = readArg('env', 'both')
  const targets = resolveTargets(envArg)
  const cutoffMinutes = Number(readArg('cutoffMinutes', '60'))
  const limit = Number(readArg('limit', '1000'))
  const maxPasses = Number(readArg('maxPasses', '1000'))

  for (const target of targets) {
    let totalDeleted = 0
    let passes = 0
    for (; passes < maxPasses; passes++) {
      const result = await callConvex<CleanupResult>(
        target,
        'mutation',
        'conversations:cleanupConversationMessageDeltas',
        {
          serverSecret: secret,
          cutoffMinutes,
          limit,
        },
      )
      totalDeleted += result.deleted
      if (result.deleted === 0 || result.scanned === 0) break
      console.log(
        `[${target.toUpperCase()}] pass ${passes + 1}: deleted ${result.deleted} ` +
        `${result.mode} delta(s), scanned ${result.scanned}`,
      )
    }
    console.log(
      `\n[${target.toUpperCase()}] Deleted ${totalDeleted} message delta(s) in ${passes + 1} pass(es)`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
