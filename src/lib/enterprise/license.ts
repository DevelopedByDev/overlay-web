import { createVerify } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export type LicenseState =
  | { status: 'missing'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'expired'; message: string; subject?: string; expiresAt?: string }
  | { status: 'valid'; subject: string; plan: string; expiresAt?: string; features: string[]; airGapped: boolean }

type LicensePayload = {
  subject: string
  plan?: string
  expiresAt?: string
  features?: string[]
  airGapped?: boolean
}

export function getLicenseState(): LicenseState {
  const raw = readLicenseKey()
  if (!raw) return { status: 'missing', message: 'No license key configured.' }
  const publicKey = process.env.OVERLAY_LICENSE_PUBLIC_KEY?.trim()
  if (!publicKey) return { status: 'invalid', message: 'OVERLAY_LICENSE_PUBLIC_KEY is required to validate an offline license.' }

  const [payloadSegment, signatureSegment] = raw.split('.')
  if (!payloadSegment || !signatureSegment) return { status: 'invalid', message: 'License key must be payload.signature.' }

  try {
    const payloadText = Buffer.from(payloadSegment, 'base64url').toString('utf8')
    const verify = createVerify('sha256')
    verify.update(payloadText)
    verify.end()
    const signatureOk = verify.verify(publicKey, Buffer.from(signatureSegment, 'base64url'))
    if (!signatureOk) return { status: 'invalid', message: 'License signature is invalid.' }

    const payload = JSON.parse(payloadText) as LicensePayload
    if (!payload.subject) return { status: 'invalid', message: 'License subject is missing.' }
    if (payload.expiresAt && Date.parse(payload.expiresAt) < Date.now()) {
      return {
        status: 'expired',
        message: 'License has expired.',
        subject: payload.subject,
        expiresAt: payload.expiresAt,
      }
    }

    return {
      status: 'valid',
      subject: payload.subject,
      plan: payload.plan ?? 'enterprise',
      expiresAt: payload.expiresAt,
      features: payload.features ?? [],
      airGapped: Boolean(payload.airGapped),
    }
  } catch (error) {
    return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
  }
}

function readLicenseKey(): string | null {
  const direct = process.env.OVERLAY_LICENSE_KEY?.trim()
  if (direct) return direct
  const path = process.env.OVERLAY_LICENSE_FILE?.trim()
  if (path && existsSync(path)) return readFileSync(path, 'utf8').trim()
  return null
}
