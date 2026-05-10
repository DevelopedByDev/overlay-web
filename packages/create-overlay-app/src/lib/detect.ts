// @enterprise-future — not wired to production

import { execSync } from 'child_process'
import { platform } from 'os'

export interface EnvInfo {
  os: string
  nodeVersion: string | null
  nodeMajor: number | null
  hasDocker: boolean
  hasGit: boolean
  hasNpm: boolean
  hasNpx: boolean
}

function getNodeVersion(): { version: string | null; major: number | null } {
  try {
    const raw = execSync('node --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    const match = raw.match(/^v?(\d+)\./)
    const major = match ? parseInt(match[1], 10) : null
    return { version: raw, major }
  } catch {
    return { version: null, major: null }
  }
}

function hasCommand(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
    return true
  } catch {
    return false
  }
}

export function detectEnvironment(): EnvInfo {
  const { version, major } = getNodeVersion()
  return {
    os: platform(),
    nodeVersion: version,
    nodeMajor: major,
    hasDocker: hasCommand('docker'),
    hasGit: hasCommand('git'),
    hasNpm: hasCommand('npm'),
    hasNpx: hasCommand('npx'),
  }
}

export function warnIfMissingDocker(info: EnvInfo): void {
  if (!info.hasDocker) {
    console.warn('  Docker not detected. On-prem/hybrid profiles require Docker for Postgres, Redis, MinIO, etc.')
    console.warn('  Install Docker: https://docs.docker.com/get-docker/\n')
  }
}

export function warnIfOldNode(info: EnvInfo): void {
  if (info.nodeMajor !== null && info.nodeMajor < 20) {
    console.warn(`  Node ${info.nodeVersion} detected. Overlay requires Node 20+.`)
    console.warn('  Install Node 20+: https://nodejs.org/\n')
  }
}
