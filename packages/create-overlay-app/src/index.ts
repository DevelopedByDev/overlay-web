// @enterprise-future — not wired to production
// Shared setup module used by both the npx CLI and the curl bootstrapper.

export { runSetup, type SetupOptions, type SetupResult } from './lib/setup.js'
export { detectEnvironment, type EnvInfo } from './lib/detect.js'
export { generateSecrets, type Secrets } from './lib/secrets.js'
export { writeProjectFiles, type ProjectFiles } from './lib/files.js'
export { runHealthCheck } from './lib/health.js'
export { profiles, type ProfileName, type ProviderChoices } from './lib/profiles.js'
