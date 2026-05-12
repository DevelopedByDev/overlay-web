import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>
}

const rootPackage = readJson('package.json')
const rootScripts = rootPackage.scripts as Record<string, string>
assert.ok(rootScripts['docs:generate:openapi'], 'root package must generate OpenAPI')
assert.ok(rootScripts['docs:generate:typedoc'], 'root package must generate TypeDoc')
assert.ok(rootScripts['docs:generate:storybook'], 'root package must build Storybook')
assert.ok(rootScripts['docs:generate'], 'root package must expose docs:generate')

const openapi = readJson('docs-site/api/openapi.json') as {
  openapi?: string
  paths?: Record<string, unknown>
}
assert.equal(openapi.openapi, '3.1.0')
assert.ok(openapi.paths && Object.keys(openapi.paths).length >= 77, 'OpenAPI spec must include generated API paths')

for (const file of [
  'scripts/generate-openapi.ts',
  'packages/overlay-ui/.storybook/main.ts',
  'packages/overlay-ui/.storybook/preview.tsx',
  'packages/overlay-ui/src/primitives/primitives.stories.tsx',
  'packages/overlay-ui/src/chat/chat.stories.tsx',
  'packages/overlay-ui/src/layout/layout.stories.tsx',
  'packages/overlay-core/typedoc.json',
  '.github/workflows/docs.yml',
  'docs-site/contributing.md',
]) {
  assert.equal(existsSync(join(root, file)), true, `${file} must exist`)
}

const uiPackage = readJson('packages/overlay-ui/package.json')
const uiScripts = uiPackage.scripts as Record<string, string>
assert.ok(uiScripts['storybook:build'], 'overlay-ui must expose storybook:build')

const mint = readJson('docs-site/mint.json') as {
  api?: { openapi?: string }
  navigation?: Array<{ pages?: string[] }>
}
assert.equal(mint.api?.openapi, '/api/openapi.json')
assert.ok(mint.navigation?.some((group) => group.pages?.includes('contributing')), 'Mintlify nav must include contributing')

console.log('Phase 12 verification passed (OpenAPI, Storybook, TypeDoc, CI, and contributing docs configured).')
