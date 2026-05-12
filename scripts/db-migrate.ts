import { PostgresDatabase } from '../packages/overlay-core/src/db/postgres.ts'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required for db:migrate.')
}

const db = new PostgresDatabase({
  url,
  migrationMode: 'manual',
  migrationsTable: process.env.OVERLAY_DB_MIGRATIONS_TABLE || '__overlay_migrations',
  pool: {
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
  },
})

try {
  await db.migrate()
  await db.init()
  console.log('[db:migrate] Postgres migrations applied.')
} finally {
  await db.shutdown()
}
