import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
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
]

for (const route of routes) {
  const source = readFileSync(join(process.cwd(), route), 'utf8')
  assert.match(source, /@\/lib\/api-schemas/, `${route} must use shared api schemas`)
  assert.match(source, /RequestSchema\s*=\s*z\./, `${route} must declare a request schema`)
  assert.match(source, /ResponseSchema\s*=\s*z\./, `${route} must declare a response schema`)
  assert.match(source, /\.openapi\(/, `${route} must register OpenAPI schema metadata`)
}

const middleware = readFileSync(join(process.cwd(), 'src/app/api/lib/middleware.ts'), 'utf8')
assert.match(middleware, /body\?: z\.ZodType/, 'middleware must accept optional body schema')
assert.match(middleware, /query\?: z\.ZodType/, 'middleware must accept optional query schema')
assert.match(middleware, /createValidatedHandler/, 'middleware must expose typed validated handler')

console.log(`Phase 8 verification passed (${routes.length} core routes have schemas).`)
