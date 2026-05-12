import { PostgresDatabase } from '../packages/overlay-core/src/db/postgres.ts'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required for db:seed.')
}

const orgId = process.env.OVERLAY_SEED_ORG_ID || 'default'
const orgName = process.env.OVERLAY_SEED_ORG_NAME || 'Default organization'
const adminEmail = process.env.OVERLAY_ADMIN_EMAIL

const db = new PostgresDatabase({ url, migrationMode: 'startup', defaultOrgId: orgId })

try {
  await db.init()
  await db.createOrganization({ id: orgId, name: orgName, slug: orgId })
  if (adminEmail) {
    const existing = await db.getUserByEmail(adminEmail)
    if (!existing) {
      await db.createUser({
        orgId,
        email: adminEmail,
        role: 'superadmin',
        emailVerified: true,
      })
      console.log(`[db:seed] Created superadmin ${adminEmail}.`)
    } else {
      console.log(`[db:seed] Admin ${adminEmail} already exists.`)
    }
  } else {
    console.log('[db:seed] OVERLAY_ADMIN_EMAIL not set; seeded organization only.')
  }
} finally {
  await db.shutdown()
}
