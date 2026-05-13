import { NextResponse } from 'next/server'
import { createHandler, withAdmin, withRequireAuth, auditLog } from '@/app/api/lib/middleware'
import { getConfig } from '@/lib/config/singleton'
import { getOverlayProviders } from '@/lib/provider-runtime'
import { validateAirGapConfig } from '@/lib/enterprise/airgap'
import { getLicenseState } from '@/lib/enterprise/license'
import { getSmtpStatus } from '@/lib/enterprise/smtp'

export const GET = createHandler(
  { middleware: [withRequireAuth, withAdmin] },
  async (_request, ctx) => {
    const config = getConfig()
    const health = await getOverlayProviders().registry.health()
    const license = getLicenseState()
    const airGapErrors = validateAirGapConfig(config)
    const smtp = getSmtpStatus(config.enterprise.smtp)

    auditLog(ctx, { action: 'view_diagnostics', resource: 'admin' })
    return NextResponse.json({
      timestamp: Date.now(),
      deployment: config.deployment,
      providers: config.providers,
      providerHealth: health,
      license,
      airGap: {
        enabled: config.enterprise.airGapped,
        valid: airGapErrors.length === 0,
        errors: airGapErrors,
      },
      smtp,
      backup: {
        configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        lastStatusPath: process.env.OVERLAY_BACKUP_STATUS_FILE || '.context/last-backup.json',
      },
    })
  },
)
