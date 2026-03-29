import {
  callConvex,
  getInternalApiSecret,
  loadLocalEnv,
  readArg,
  resolveTargets,
  type DeploymentTarget,
} from './convex-admin-utils.ts'

type InspectResult = {
  inspected: number
  results: Array<{
    tableName: string
    exists: boolean
    count: number
    error?: string
  }>
}

type PurgeResult = {
  purged: number
  results: Array<{
    tableName: string
    deleted: number
    error?: string
  }>
}

function parseTableNames(raw?: string): string[] | undefined {
  if (!raw) return undefined
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

function printInspect(target: DeploymentTarget, label: string, result: InspectResult) {
  console.log(`\n[${target.toUpperCase()}] ${label}`)
  for (const row of result.results) {
    const status = row.exists ? `${row.count} rows` : `missing (${row.error ?? 'unknown'})`
    console.log(`- ${row.tableName}: ${status}`)
  }
}

function printPurge(target: DeploymentTarget, result: PurgeResult) {
  console.log(`\n[${target.toUpperCase()}] purge`)
  for (const row of result.results) {
    if (row.error) {
      console.log(`- ${row.tableName}: deleted ${row.deleted}, error: ${row.error}`)
    } else {
      console.log(`- ${row.tableName}: deleted ${row.deleted}`)
    }
  }
}

async function main() {
  loadLocalEnv()
  const secret = getInternalApiSecret()
  const envArg = readArg('env', 'both')
  const targets = resolveTargets(envArg)
  const tableNames = parseTableNames(readArg('tables'))
  const batchSizeArg = readArg('batchSize')
  const batchSize = batchSizeArg ? Number(batchSizeArg) : undefined

  for (const target of targets) {
    const before = await callConvex<InspectResult>(
      target,
      'query',
      'storageAdmin:inspectLegacyTablesByServer',
      { serverSecret: secret, tableNames },
    )
    printInspect(target, 'before', before)

    const purged = await callConvex<PurgeResult>(
      target,
      'mutation',
      'storageAdmin:purgeLegacyTablesByServer',
      { serverSecret: secret, tableNames, batchSize },
    )
    printPurge(target, purged)

    const after = await callConvex<InspectResult>(
      target,
      'query',
      'storageAdmin:inspectLegacyTablesByServer',
      { serverSecret: secret, tableNames },
    )
    printInspect(target, 'after', after)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
