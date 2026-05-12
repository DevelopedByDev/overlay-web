export default {
  dialect: 'postgresql',
  schema: './packages/overlay-core/src/db/postgres-schema.ts',
  out: './packages/overlay-core/drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  },
}
