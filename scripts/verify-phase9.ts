import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
  'src/app/api/auth/callback/route.ts',
  'src/app/api/auth/convex-token/route.ts',
  'src/app/api/auth/desktop-link/route.ts',
  'src/app/api/auth/forgot-password/route.ts',
  'src/app/api/auth/native/authorize/route.ts',
  'src/app/api/auth/native/exchange/route.ts',
  'src/app/api/auth/native/provider-keys/route.ts',
  'src/app/api/auth/native/refresh/route.ts',
  'src/app/api/auth/native/subscription/route.ts',
  'src/app/api/auth/reset-password/route.ts',
  'src/app/api/auth/session/route.ts',
  'src/app/api/auth/sign-in/route.ts',
  'src/app/api/auth/sign-out/route.ts',
  'src/app/api/auth/sign-up/route.ts',
  'src/app/api/auth/sso/[provider]/route.ts',
  'src/app/api/auth/sync-profile/route.ts',
  'src/app/api/auth/verify-email/route.ts',
  'src/app/api/account/delete/route.ts',
  'src/app/api/security/csp-report/route.ts',
]

for (const route of routes) {
  const source = readFileSync(join(process.cwd(), route), 'utf8')
  assert.match(source, /@\/lib\/api-schemas/, `${route} must use shared api schemas`)
  assert.match(source, /RequestSchema\s*=\s*z\./, `${route} must declare a request schema`)
  assert.match(source, /ResponseSchema\s*=\s*z\./, `${route} must declare a response schema`)
  assert.match(source, /\.openapi\(/, `${route} must register OpenAPI schema metadata`)
}

console.log(`Phase 9 verification passed (${routes.length} auth/security routes have schemas).`)
