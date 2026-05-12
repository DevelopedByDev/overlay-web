import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = [
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
]

for (const route of routes) {
  const source = readFileSync(join(process.cwd(), route), 'utf8')
  assert.match(source, /@\/lib\/api-schemas/, `${route} must use shared api schemas`)
  assert.match(source, /RequestSchema\s*=\s*z\./, `${route} must declare a request schema`)
  assert.match(source, /ResponseSchema\s*=\s*z\./, `${route} must declare a response schema`)
  assert.match(source, /\.openapi\(/, `${route} must register OpenAPI schema metadata`)
}

console.log(`Phase 10 verification passed (${routes.length} AI/tool routes have schemas).`)
