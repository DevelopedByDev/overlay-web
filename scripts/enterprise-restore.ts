import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const backupDir = process.argv[2] || process.env.OVERLAY_BACKUP_DIR
if (!backupDir) throw new Error('Usage: tsx scripts/enterprise-restore.ts <backup-dir>')

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!databaseUrl) throw new Error('DATABASE_URL or POSTGRES_URL is required for restore.')

const dumpPath = join(backupDir, 'postgres.dump')
if (!existsSync(dumpPath)) throw new Error(`Postgres dump not found: ${dumpPath}`)

const result = spawnSync('pg_restore', ['--clean', '--if-exists', '--dbname', databaseUrl, dumpPath], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
console.log(`[enterprise:restore] Restored ${dumpPath}`)
