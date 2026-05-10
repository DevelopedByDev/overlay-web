// @enterprise-future — not wired to production

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
// ora v8+ is ESM-only; type declarations are bundled
import ora from 'ora'
import { detectEnvironment, warnIfMissingDocker, warnIfOldNode } from './detect.js'
import { profiles, type ProfileName, type ProviderChoices, getRequiredEnvVars } from './profiles.js'
import { generateSecrets } from './secrets.js'
import { writeProjectFiles } from './files.js'
import { runHealthCheck } from './health.js'

export interface SetupOptions {
  profile: ProfileName
  tag?: string
  nonInteractive?: boolean
  dockerOnly?: boolean
  skipInstall?: boolean
  skipStart?: boolean
}

export interface SetupResult {
  success: boolean
  directory: string
  started: boolean
  error?: string
}

export async function runSetup(directory: string, options: SetupOptions): Promise<SetupResult> {
  const targetDir = join(process.cwd(), directory)

  // 1. Environment detection
  const spinner = ora('Detecting environment...').start()
  const envInfo = detectEnvironment()
  spinner.succeed(`Detected: Node ${envInfo.nodeVersion || 'N/A'}, ${envInfo.os}, Docker: ${envInfo.hasDocker ? 'yes' : 'no'}`)
  warnIfOldNode(envInfo)

  // 2. Non-interactive profile selection
  const profile = options.profile
  const choices = profiles[profile]
  if (!choices) {
    return { success: false, directory: targetDir, started: false, error: `Unknown profile: ${profile}` }
  }

  if (profile !== 'saas') {
    warnIfMissingDocker(envInfo)
  }

  // 3. Determine clone vs docker-only
  if (options.dockerOnly) {
    const secrets = generateSecrets()
    mkdirSync(targetDir, { recursive: true })
    writeProjectFiles(targetDir, choices, secrets, {})
    return { success: true, directory: targetDir, started: false }
  }

  // 4. Clone repo
  const cloneSpinner = ora(`Cloning overlay into ${directory}...`).start()
  try {
    if (existsSync(targetDir) && existsSync(join(targetDir, '.git'))) {
      cloneSpinner.warn(`Directory ${directory} already exists and is a git repo. Skipping clone.`)
    } else {
      const tag = options.tag || 'main'
      execSync(`git clone --depth 1 --branch ${tag} https://github.com/getoverlay/overlay.git ${directory}`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      cloneSpinner.succeed(`Cloned overlay (${tag})`)
    }
  } catch (err) {
    cloneSpinner.fail('Clone failed')
    return {
      success: false,
      directory: targetDir,
      started: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 5. Generate secrets & write config files
  const configSpinner = ora('Generating configuration...').start()
  const secrets = generateSecrets()
  const customEnv: Record<string, string> = {}

  // In non-interactive mode, we don't prompt for keys; user fills them in later
  writeProjectFiles(targetDir, choices, secrets, customEnv)

  // Write a setup-notes.md for the user
  const notes = buildSetupNotes(profile, choices, getRequiredEnvVars(choices))
  writeFileSync(join(targetDir, 'SETUP_NOTES.md'), notes)
  configSpinner.succeed('Configuration written')

  // 6. Install dependencies
  if (!options.skipInstall) {
    const installSpinner = ora('Installing dependencies...').start()
    try {
      execSync('npm install', { cwd: targetDir, stdio: ['pipe', 'pipe', 'pipe'] })
      installSpinner.succeed('Dependencies installed')
    } catch {
      installSpinner.fail('npm install failed')
      console.warn(chalk.yellow('  You may need to run npm install manually.'))
    }
  }

  // 7. Start (if on-prem and Docker available)
  let started = false
  if (!options.skipStart && profile !== 'saas' && envInfo.hasDocker) {
    const startSpinner = ora('Starting Docker services...').start()
    try {
      execSync('docker compose -f docker/docker-compose.enterprise.yml up -d', {
        cwd: targetDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      startSpinner.succeed('Docker services started')

      // Wait a few seconds for services to be ready
      await new Promise((r) => setTimeout(r, 5000))

      // 8. Health check
      const healthSpinner = ora('Waiting for health check...').start()
      const health = await runHealthCheck('http://localhost:3000', 30000)
      if (health.status === 'ok') {
        healthSpinner.succeed('All services healthy')
        started = true
      } else {
        healthSpinner.warn('Some services are not yet ready (this is normal on first boot)')
        console.log(chalk.dim('  Run: docker compose -f docker/docker-compose.enterprise.yml logs -f'))
      }
    } catch {
      startSpinner.fail('Failed to start services')
      console.warn(chalk.yellow('  You may need to start them manually: docker compose up -d'))
    }
  }

  return { success: true, directory: targetDir, started }
}

function buildSetupNotes(profile: string, choices: ProviderChoices, requiredVars: string[]): string {
  const lines = [
    '# Overlay Setup Notes',
    '',
    `Profile: **${profile}**`,
    '',
    '## Provider Selection',
    ...Object.entries(choices).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Required Environment Variables',
    'The following variables in `.env.local` need manual configuration:',
    ...requiredVars.map((v) => `- \`${v}\``),
    '',
    '## Next Steps',
    '1. Review and edit `.env.local` with your actual API keys.',
    '2. For on-prem/hybrid: ensure Docker services are running.',
    '3. Run: npm run dev',
    '4. Open http://localhost:3000',
    '',
    '*Generated by create-overlay-app*',
  ]
  return lines.join('\n')
}
