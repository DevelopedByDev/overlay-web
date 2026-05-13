import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageLock = existsSync('package-lock.json')
  ? JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages?: Record<string, { version?: string; license?: string }> }
  : {}

const packages = Object.entries(packageLock.packages ?? {})
  .filter(([name]) => name.startsWith('node_modules/'))
  .map(([name, info]) => ({
    name: name.replace('node_modules/', ''),
    version: info.version ?? 'unknown',
    license: info.license ?? 'unknown',
  }))

const sourceFiles = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'packages')),
  ...walk(join(root, 'scripts')),
].filter((file) => /\.(ts|tsx)$/.test(file))

const auditCoverage = sourceFiles
  .filter((file) => readFileSync(file, 'utf8').includes('auditLog(') || readFileSync(file, 'utf8').includes('logAuditEvent('))
  .map((file) => file.slice(root.length + 1))

const report = {
  generatedAt: new Date().toISOString(),
  sbom: {
    format: 'overlay-minimal-json',
    packageCount: packages.length,
    packages,
  },
  auditCoverage: {
    filesWithAuditEvents: auditCoverage.length,
    files: auditCoverage,
  },
  hardeningChecklist: [
    'Set strong SESSION_SECRET, INTERNAL_API_SECRET, and provider secrets.',
    'Run behind TLS with trusted proxy headers configured correctly.',
    'Use Postgres, Redis/Valkey, and MinIO persistent volumes with backups.',
    'Enable air-gapped mode for offline deployments and validate no hosted providers are configured.',
    'Run container vulnerability scanning in CI before release.',
  ],
}

mkdirSync(join(root, '.context'), { recursive: true })
writeFileSync(join(root, '.context', 'compliance-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}
