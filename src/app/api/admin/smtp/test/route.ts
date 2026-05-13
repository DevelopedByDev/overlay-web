import { NextResponse } from 'next/server'
import { z } from '@/lib/api-schemas'
import { createValidatedHandler, withAdmin, withRequireAuth, auditLog } from '@/app/api/lib/middleware'
import { getConfig } from '@/lib/config/singleton'
import { sendSmtpEmail } from '@/lib/enterprise/smtp'

const SmtpTestBody = z.object({
  to: z.string().email(),
})

export const POST = createValidatedHandler(
  { body: SmtpTestBody },
  async (_request, parsed, ctx) => {
    const to = parsed.body!.to
    await sendSmtpEmail(getConfig().enterprise.smtp, {
      to,
      subject: 'Overlay SMTP test',
      text: 'This is a test email from your Overlay enterprise deployment.',
    })
    auditLog(ctx, { action: 'smtp_test_email', resource: 'admin', metadata: { to } })
    return NextResponse.json({ ok: true })
  },
  { middleware: [withRequireAuth, withAdmin] },
)
