import 'server-only'

import { posix as pathPosix } from 'node:path'
import { CodeLanguage, Daytona, type Sandbox } from '@daytonaio/sdk'

export type DaytonaRuntime = 'node' | 'python'

export interface DaytonaPaths {
  workDir: string
  rootDir: string
  inputDir: string
  runDir: string
  outputDir: string
  stdoutPath: string
  stderrPath: string
}

let daytonaClient: Daytona | null = null

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getDaytonaClient(): Daytona {
  if (daytonaClient) {
    return daytonaClient
  }

  const apiKey = process.env.DAYTONA_API_KEY?.trim()
  const apiUrl = process.env.DAYTONA_API_URL?.trim()

  if (!apiKey) {
    throw new Error('DAYTONA_API_KEY is not configured.')
  }

  if (!apiUrl) {
    throw new Error('DAYTONA_API_URL is not configured.')
  }

  daytonaClient = new Daytona({
    apiKey,
    apiUrl,
  })

  return daytonaClient
}

function getSandboxLanguage(runtime: DaytonaRuntime): CodeLanguage {
  return runtime === 'node' ? CodeLanguage.JAVASCRIPT : CodeLanguage.PYTHON
}

export async function createEphemeralSandbox(params: {
  runtime: DaytonaRuntime
  envVars?: Record<string, string>
  labels?: Record<string, string>
}): Promise<Sandbox> {
  return await getDaytonaClient().create(
    {
      language: getSandboxLanguage(params.runtime),
      envVars: params.envVars,
      labels: params.labels,
      ephemeral: true,
      autoStopInterval: 15,
      autoDeleteInterval: 0,
    },
    { timeout: 90 },
  )
}

export async function getSandboxPaths(sandbox: Sandbox): Promise<DaytonaPaths> {
  const workDir = trimTrailingSlash((await sandbox.getWorkDir()) || '/home/daytona')
  const rootDir = pathPosix.join(workDir, 'overlay-sandbox')
  const outputDir = pathPosix.join(rootDir, 'outputs')

  return {
    workDir,
    rootDir,
    inputDir: pathPosix.join(rootDir, 'inputs'),
    runDir: pathPosix.join(rootDir, 'run'),
    outputDir,
    stdoutPath: pathPosix.join(outputDir, '.overlay-stdout.log'),
    stderrPath: pathPosix.join(outputDir, '.overlay-stderr.log'),
  }
}

export async function prepareSandboxWorkspace(
  sandbox: Sandbox,
  paths: DaytonaPaths,
): Promise<void> {
  await sandbox.process.executeCommand(
    [
      `mkdir -p ${shellQuote(paths.rootDir)}`,
      `mkdir -p ${shellQuote(paths.inputDir)}`,
      `mkdir -p ${shellQuote(paths.runDir)}`,
      `mkdir -p ${shellQuote(paths.outputDir)}`,
    ].join(' && '),
    paths.workDir,
    undefined,
    30,
  )
}

export async function uploadSandboxBuffer(
  sandbox: Sandbox,
  remotePath: string,
  contents: Buffer | string,
): Promise<void> {
  const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8')
  await sandbox.fs.uploadFile(data, remotePath, 60)
}

export async function executeSandboxCommand(
  sandbox: Sandbox,
  params: {
    command: string
    cwd: string
    env?: Record<string, string>
    stdoutPath: string
    stderrPath: string
  },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const commandPath = pathPosix.join(params.cwd, '.overlay-command.sh')
  const commandScript = `${params.command.trimEnd()}\n`

  await uploadSandboxBuffer(
    sandbox,
    commandPath,
    `#!/usr/bin/env bash\nset -o pipefail\n${commandScript}`,
  )
  await sandbox.fs.setFilePermissions(commandPath, { mode: '755' })

  const wrappedCommand =
    `mkdir -p ${shellQuote(pathPosix.dirname(params.stdoutPath))} && ` +
    `${shellQuote(commandPath)} > ${shellQuote(params.stdoutPath)} 2> ${shellQuote(params.stderrPath)}; ` +
    'EXIT_CODE=$?; ' +
    `if [ -f ${shellQuote(params.stdoutPath)} ]; then cat ${shellQuote(params.stdoutPath)}; fi; ` +
    'exit $EXIT_CODE'

  const response = await sandbox.process.executeCommand(
    wrappedCommand,
    params.cwd,
    params.env,
    300,
  )

  let stderr = ''
  try {
    stderr = (await sandbox.fs.downloadFile(params.stderrPath, 60)).toString('utf8')
  } catch {
    stderr = ''
  }

  return {
    exitCode: response.exitCode,
    stdout: response.result || '',
    stderr,
  }
}

export async function downloadSandboxFile(
  sandbox: Sandbox,
  remotePath: string,
): Promise<Buffer> {
  return await sandbox.fs.downloadFile(remotePath, 60)
}

export async function deleteSandbox(sandbox: Sandbox | null | undefined): Promise<void> {
  if (!sandbox) return
  await sandbox.delete(60)
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
