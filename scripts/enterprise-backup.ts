import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.env.OVERLAY_BACKUP_DIR || join(process.cwd(), '.context', 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
mkdirSync(outDir, { recursive: true })

const status: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  outDir,
  postgres: 'skipped',
  config: 'skipped',
  minio: 'manual',
}

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (databaseUrl) {
  const dumpPath = join(outDir, 'postgres.dump')
  const result = spawnSync('pg_dump', ['--format=custom', '--file', dumpPath, databaseUrl], { stdio: 'inherit' })
  status.postgres = result.status === 0 ? { status: 'ok', path: dumpPath } : { status: 'failed', code: result.status }
} else {
  status.postgres = { status: 'skipped', reason: 'DATABASE_URL/POSTGRES_URL not set' }
}

for (const file of ['overlay.config.json', '.env.enterprise', '.env.enterprise.example']) {
  if (!existsSync(file)) continue
  copyFileSync(file, join(outDir, file.replace(/^\./, '').replace(/\//g, '_')))
}
status.config = 'ok'
status.minio = 'Use `mc mirror` or object-store-native snapshots for large buckets; config records MINIO_BUCKET_NAME.'
status.completedAt = new Date().toISOString()

const statusPath = process.env.OVERLAY_BACKUP_STATUS_FILE || join(process.cwd(), '.context', 'last-backup.json')
mkdirSync(join(statusPath, '..'), { recursive: true })
writeFileSync(join(outDir, 'backup-status.json'), JSON.stringify(status, null, 2))
writeFileSync(statusPath, JSON.stringify(status, null, 2))
console.log(JSON.stringify(status, null, 2))
