import { existsSync } from 'node:fs'
import { loadConfig } from '../src/lib/config/loader.ts'
import { validateAirGapConfig } from '../src/lib/enterprise/airgap.ts'
import { getLicenseState } from '../src/lib/enterprise/license.ts'

const config = loadConfig()
const errors: string[] = []

if (config.providers.database === 'postgres' && !(process.env.DATABASE_URL || process.env.POSTGRES_URL || config.database.postgres.url)) {
  errors.push('Postgres provider selected but DATABASE_URL/POSTGRES_URL is missing.')
}
if (!existsSync('docker/docker-compose.enterprise.yml')) errors.push('Enterprise Docker Compose file is missing.')
errors.push(...validateAirGapConfig(config))

const license = getLicenseState()
if (config.enterprise.airGapped && license.status !== 'valid') {
  errors.push(`Air-gapped deployments require a valid offline license; current state is ${license.status}.`)
}

const report = {
  ok: errors.length === 0,
  checkedAt: new Date().toISOString(),
  providers: config.providers,
  license,
  errors,
}

console.log(JSON.stringify(report, null, 2))
if (errors.length > 0) process.exit(1)
