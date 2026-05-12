import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const configPath = join(root, 'overlay.config.json')
const schemaSource = readFileSync(join(root, 'src/lib/config/schema.ts'), 'utf8')
const loaderSource = readFileSync(join(root, 'src/lib/config/loader.ts'), 'utf8')
const singletonSource = readFileSync(join(root, 'src/lib/config/singleton.ts'), 'utf8')
const providerSource = readFileSync(join(root, 'src/lib/config/ConfigProvider.tsx'), 'utf8')
const hookSource = readFileSync(join(root, 'src/lib/config/useConfig.ts'), 'utf8')

assert.equal(existsSync(configPath), true, 'overlay.config.json must exist')
const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
  version?: string
  deployment?: { mode?: string; domain?: string }
  security?: { sessionCookie?: { httpOnly?: boolean } }
}
assert.equal(config.version, '1.0.0')
assert.ok(config.deployment?.mode, 'deployment.mode must be configured')
assert.ok(config.deployment?.domain, 'deployment.domain must be configured')
assert.equal(config.security?.sessionCookie?.httpOnly, true)

assert.match(schemaSource, /export const OverlayConfig = z\.object/, 'schema must export OverlayConfig')
assert.match(schemaSource, /export type OverlayConfigType/, 'schema must export OverlayConfigType')
assert.match(loaderSource, /export function loadConfig/, 'loader must export loadConfig')
assert.match(loaderSource, /envOverrides/, 'loader must support environment overrides')
assert.match(loaderSource, /deepMerge/, 'loader must merge defaults, file config, and env')
assert.match(singletonSource, /export function getConfig/, 'singleton must export getConfig')
assert.match(providerSource, /export function ConfigProvider/, 'React config provider must exist')
assert.match(hookSource, /export function useConfig/, 'client hook must exist')

const migratedFiles = [
  'src/lib/rate-limit.ts',
  'src/app/api/lib/middleware.ts',
  'src/lib/workos-auth.ts',
  'src/app/api/app/onboarding/status/route.ts',
  'src/app/api/app/onboarding/complete/route.ts',
  'src/app/api/app/files/presign/route.ts',
].filter((file) => readFileSync(join(root, file), 'utf8').includes('getConfig()'))

assert.ok(migratedFiles.length >= 5, `expected >= 5 config migrations, found ${migratedFiles.length}`)

console.log(`Phase 7 verification passed (${migratedFiles.length} env/config reads migrated).`)
