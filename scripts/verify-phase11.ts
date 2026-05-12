import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const phase11Routes = [
  'src/app/api/checkout/route.ts',
  'src/app/api/checkout/verify/route.ts',
  'src/app/api/entitlements/route.ts',
  'src/app/api/portal/route.ts',
  'src/app/api/subscription/route.ts',
  'src/app/api/subscription/settings/route.ts',
  'src/app/api/topups/checkout/route.ts',
  'src/app/api/topups/history/route.ts',
  'src/app/api/topups/verify/route.ts',
  'src/app/api/webhooks/stripe/route.ts',
  'src/app/api/admin/audit/route.ts',
  'src/app/api/admin/impersonate/route.ts',
  'src/app/api/admin/settings/route.ts',
  'src/app/api/admin/users/route.ts',
  'src/app/api/latest-release/route.ts',
  'src/app/api/latest-release/download/route.ts',
  'src/app/api/convex/[type]/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/health/dependencies/route.ts',
  'src/app/api/app/subscription/route.ts',
]

const allSchemaRoutes = [
  ...[
    'src/app/api/app/bootstrap/route.ts',
    'src/app/api/app/conversations/route.ts',
    'src/app/api/app/conversations/message/route.ts',
    'src/app/api/app/conversations/act/route.ts',
    'src/app/api/app/conversations/act/extension-plan/route.ts',
    'src/app/api/app/conversations/stop/route.ts',
    'src/app/api/app/files/route.ts',
    'src/app/api/app/files/presign/route.ts',
    'src/app/api/app/files/upload-url/route.ts',
    'src/app/api/app/files/ingest-document/route.ts',
    'src/app/api/app/files/search-text/route.ts',
    'src/app/api/app/files/[fileId]/content/route.ts',
    'src/app/api/app/settings/route.ts',
    'src/app/api/app/notes/route.ts',
    'src/app/api/app/memory/route.ts',
    'src/app/api/app/projects/route.ts',
    'src/app/api/app/outputs/route.ts',
    'src/app/api/app/outputs/[outputId]/content/route.ts',
    'src/app/api/app/onboarding/status/route.ts',
    'src/app/api/app/onboarding/complete/route.ts',
  ],
  ...[
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
  ],
  ...[
    'src/app/api/app/chat-suggestions/route.ts',
    'src/app/api/app/generate-image/route.ts',
    'src/app/api/app/generate-tab-group-label/route.ts',
    'src/app/api/app/generate-title/route.ts',
    'src/app/api/app/generate-video/route.ts',
    'src/app/api/app/browser-task/route.ts',
    'src/app/api/app/daytona/run/route.ts',
    'src/app/api/app/mcps/route.ts',
    'src/app/api/app/mcps/test/route.ts',
    'src/app/api/app/skills/route.ts',
    'src/app/api/app/integrations/route.ts',
    'src/app/api/app/automations/route.ts',
    'src/app/api/app/automations/run/route.ts',
    'src/app/api/app/automations/test/route.ts',
    'src/app/api/app/notebook-agent/route.ts',
    'src/app/api/app/knowledge/search/route.ts',
    'src/app/api/app/transcribe/route.ts',
    'src/app/api/app/onboarding/reset/route.ts',
  ],
  ...phase11Routes,
]

function assertRouteSchemas(route: string) {
  const source = readFileSync(join(process.cwd(), route), 'utf8')
  assert.match(source, /@\/lib\/api-schemas/, `${route} must use shared api schemas`)
  assert.match(source, /RequestSchema\s*=\s*z\./, `${route} must declare a request schema`)
  assert.match(source, /ResponseSchema\s*=\s*z\./, `${route} must declare a response schema`)
  assert.match(source, /\.openapi\(/, `${route} must register OpenAPI schema metadata`)
}

for (const route of phase11Routes) assertRouteSchemas(route)
for (const route of allSchemaRoutes) assertRouteSchemas(route)

assert.equal(new Set(allSchemaRoutes).size, 77, 'expected 77 schema-covered routes')

console.log(`Phase 11 verification passed (${phase11Routes.length} system routes, ${allSchemaRoutes.length} total routes).`)
