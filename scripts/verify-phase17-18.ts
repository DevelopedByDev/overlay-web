import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { existsSync } from 'node:fs'
import { getMetricsText, incrementMetric, resetMetricsForTests } from '../src/lib/enterprise/metrics.ts'
import { sanitizeForLog } from '../src/lib/enterprise/logger.ts'
import { validateAirGapConfig } from '../src/lib/enterprise/airgap.ts'
import { getSmtpStatus } from '../src/lib/enterprise/smtp.ts'
import { getLicenseState } from '../src/lib/enterprise/license.ts'

async function main() {
  resetMetricsForTests()
  incrementMetric('overlay_verify_total', 'Verification counter', { phase: '17-18' })
  assert.match(getMetricsText(), /overlay_verify_total\{phase="17-18"\} 1/)

  assert.deepEqual(
    sanitizeForLog({ apiKey: 'sk-test-secret-value', nested: { token: 'abc' } }),
    { apiKey: '[REDACTED]', nested: { token: '[REDACTED]' } },
  )

  const airGapErrors = validateAirGapConfig({
    enterprise: { airGapped: true },
    providers: { aiGateway: 'vercel-ai', auth: 'workos', billing: 'stripe', database: 'convex', storage: 'r2' },
  } as any)
  assert.ok(airGapErrors.length >= 5)

  assert.equal(getSmtpStatus({ host: 'smtp.example.test', port: 587, secure: false, from: 'ops@example.test', heloName: 'overlay.local' }).configured, true)

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const payload = JSON.stringify({ subject: 'acme', plan: 'enterprise', features: ['airgap'], airGapped: true })
  const signature = createSign('sha256')
  signature.update(payload)
  signature.end()
  const oldKey = process.env.OVERLAY_LICENSE_KEY
  const oldPublic = process.env.OVERLAY_LICENSE_PUBLIC_KEY
  process.env.OVERLAY_LICENSE_KEY = `${Buffer.from(payload).toString('base64url')}.${signature.sign(privateKey).toString('base64url')}`
  process.env.OVERLAY_LICENSE_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const license = getLicenseState()
  assert.equal(license.status, 'valid')
  process.env.OVERLAY_LICENSE_KEY = oldKey
  process.env.OVERLAY_LICENSE_PUBLIC_KEY = oldPublic

  for (const path of [
    'src/app/api/metrics/route.ts',
    'src/app/api/health/live/route.ts',
    'src/app/api/health/ready/route.ts',
    'src/app/api/admin/diagnostics/route.ts',
    'scripts/enterprise-backup.ts',
    'scripts/enterprise-restore.ts',
    'scripts/enterprise-upgrade-preflight.ts',
    'scripts/compliance-report.ts',
  ]) {
    assert.equal(existsSync(path), true, `${path} exists`)
  }

  console.log('[verify-phase17-18] observability, operations, license, air-gap, SMTP, and compliance surfaces verified.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
