// @enterprise-future — not wired to production

import { randomBytes } from 'crypto'

export interface Secrets {
  jwtSecret: string
  cookieSecret: string
  encryptionKey: string
  postgresPassword: string
  meiliMasterKey: string
  minioRootUser: string
  minioRootPassword: string
}

export function generateSecrets(): Secrets {
  return {
    jwtSecret: randomBytes(32).toString('base64url'),
    cookieSecret: randomBytes(32).toString('base64url'),
    encryptionKey: randomBytes(32).toString('hex'),
    postgresPassword: randomBytes(16).toString('hex'),
    meiliMasterKey: randomBytes(16).toString('base64url'),
    minioRootUser: 'overlay',
    minioRootPassword: randomBytes(16).toString('hex'),
  }
}
