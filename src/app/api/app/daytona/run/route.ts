import { posix as pathPosix } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import {
  createEphemeralSandbox,
  deleteSandbox,
  downloadSandboxFile,
  executeSandboxCommand,
  getSandboxPaths,
  prepareSandboxWorkspace,
  uploadSandboxBuffer,
  type DaytonaRuntime,
} from '@/lib/daytona'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { classifyOutputType } from '@/lib/output-types'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getSession } from '@/lib/workos-auth'
import { validateServerSecret } from '../../../../../../convex/lib/auth'

export const maxDuration = 300

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

interface OverlayFileRecord {
  _id: string
  name: string
  content: string
  storageId?: string | null
}

interface SandboxArtifactResponse {
  outputId: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  url?: string
  type: string
}

function sanitizeFileName(name: string, fallback: string): string {
  const normalized = name
    .trim()
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')

  return normalized || fallback
}

function resolveExpectedOutputPath(baseDir: string, candidate: string): string {
  const trimmed = candidate.trim()
  if (!trimmed) {
    throw new Error('Expected output paths cannot be empty.')
  }

  const resolved = trimmed.startsWith('/')
    ? pathPosix.normalize(trimmed)
    : pathPosix.normalize(pathPosix.join(baseDir, trimmed))

  if (!resolved.startsWith(baseDir)) {
    throw new Error(`Expected output path escapes the sandbox workspace: ${candidate}`)
  }

  return resolved
}

function guessMimeType(fileName: string, buffer: Buffer): string | undefined {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.mov')) return 'video/quicktime'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8'
  if (lower.endsWith('.csv')) return 'text/csv; charset=utf-8'
  if (lower.endsWith('.txt') || lower.endsWith('.log') || lower.endsWith('.md')) return 'text/plain; charset=utf-8'
  if (lower.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (lower.endsWith('.ts')) return 'text/typescript; charset=utf-8'
  if (lower.endsWith('.py')) return 'text/x-python; charset=utf-8'

  const looksText = buffer.length === 0 || !buffer.includes(0)
  return looksText ? 'text/plain; charset=utf-8' : 'application/octet-stream'
}

async function readOverlayFileBuffer(file: OverlayFileRecord): Promise<Buffer> {
  if (file.storageId) {
    const response = await fetch(file.content)
    if (!response.ok) {
      throw new Error(`Failed to fetch Overlay file "${file.name}" from storage.`)
    }
    return Buffer.from(await response.arrayBuffer())
  }

  return Buffer.from(file.content ?? '', 'utf8')
}

async function waitForSandboxFile(
  sandbox: Awaited<ReturnType<typeof createEphemeralSandbox>>,
  remotePath: string,
  attempts = 5,
  delayMs = 300,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const details = await sandbox.fs.getFileDetails(remotePath)
      if (details && !details.isDir) {
        return details
      }
    } catch {
      // retry
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const session = await getSession()

  const {
    task,
    runtime,
    command,
    code,
    inputFileIds,
    expectedOutputs,
    userId: requestedUserId,
    accessToken,
    serverSecret: providedServerSecret,
  }: {
    task?: string
    runtime?: DaytonaRuntime
    command?: string
    code?: string
    inputFileIds?: string[]
    expectedOutputs?: string[]
    userId?: string
    accessToken?: string
    serverSecret?: string
  } = await request.json()

  if (!task?.trim()) {
    return NextResponse.json({ error: 'Task is required' }, { status: 400 })
  }
  if (runtime !== 'node' && runtime !== 'python') {
    return NextResponse.json({ error: 'runtime must be "node" or "python"' }, { status: 400 })
  }
  if (!command?.trim()) {
    return NextResponse.json({ error: 'command is required' }, { status: 400 })
  }
  if (!Array.isArray(expectedOutputs) || expectedOutputs.length === 0) {
    return NextResponse.json({ error: 'expectedOutputs must include at least one path' }, { status: 400 })
  }

  let userId: string | null = session?.user.id ?? null
  if (!userId) {
    if (validateServerSecret(providedServerSecret) && typeof requestedUserId === 'string' && requestedUserId.trim()) {
      userId = requestedUserId.trim()
    } else {
      const auth = await resolveAuthenticatedAppUser(request, {
        accessToken,
        userId: requestedUserId,
      })
      userId = auth?.userId ?? null
    }
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serverSecret = getInternalApiSecret()
  const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
    userId,
    serverSecret,
  })

  if (!entitlements) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
      { status: 401 },
    )
  }
  if (entitlements.tier === 'free') {
    return NextResponse.json(
      { error: 'sandbox_not_allowed', message: 'Daytona sandbox execution requires Pro or Max.' },
      { status: 403 },
    )
  }

  let sandbox = null

  try {
    sandbox = await createEphemeralSandbox({
      runtime,
      labels: {
        overlay: 'true',
        feature: 'sandbox-tool',
        userId,
      },
    })

    const paths = await getSandboxPaths(sandbox)
    await prepareSandboxWorkspace(sandbox, paths)

    const uploadedFiles: Array<{ fileId: string; fileName: string; sandboxPath: string }> = []
    const seenNames = new Map<string, number>()

    for (const rawFileId of inputFileIds ?? []) {
      const fileId = rawFileId.trim()
      if (!fileId) continue

      const file = await convex.query<OverlayFileRecord | null>('files:get', {
        fileId,
        userId,
        serverSecret,
      })
      if (!file) {
        throw new Error(`Overlay file not found: ${fileId}`)
      }

      const baseName = sanitizeFileName(file.name, `input-${uploadedFiles.length + 1}`)
      const seenCount = seenNames.get(baseName) ?? 0
      seenNames.set(baseName, seenCount + 1)
      const finalName = seenCount === 0 ? baseName : `${seenCount + 1}-${baseName}`
      const sandboxPath = pathPosix.join(paths.inputDir, finalName)
      const contents = await readOverlayFileBuffer(file)

      await uploadSandboxBuffer(sandbox, sandboxPath, contents)
      uploadedFiles.push({ fileId, fileName: finalName, sandboxPath })
    }

    let inlineCodePath: string | undefined
    if (typeof code === 'string' && code.length > 0) {
      inlineCodePath = pathPosix.join(paths.runDir, runtime === 'node' ? 'main.js' : 'main.py')
      await uploadSandboxBuffer(sandbox, inlineCodePath, code)
    }

    const normalizedCommand = command.trim()
    const normalizedTask = task.trim()
    const execution = await executeSandboxCommand(sandbox, {
      command: normalizedCommand,
      cwd: paths.rootDir,
      env: {
        OVERLAY_TASK: normalizedTask,
        OVERLAY_WORK_DIR: paths.rootDir,
        OVERLAY_INPUT_DIR: paths.inputDir,
        OVERLAY_RUN_DIR: paths.runDir,
        OVERLAY_OUTPUT_DIR: paths.outputDir,
        ...(inlineCodePath ? { OVERLAY_INLINE_CODE_PATH: inlineCodePath } : {}),
      },
      stdoutPath: paths.stdoutPath,
      stderrPath: paths.stderrPath,
    })

    const artifacts: SandboxArtifactResponse[] = []
    const missingExpectedOutputs: string[] = []

    for (const rawExpected of expectedOutputs) {
      const remotePath = resolveExpectedOutputPath(paths.rootDir, rawExpected)

      const details = await waitForSandboxFile(sandbox, remotePath)
      if (!details) {
        missingExpectedOutputs.push(rawExpected)
        continue
      }
      if (details.isDir) {
        missingExpectedOutputs.push(rawExpected)
        continue
      }

      const artifactBuffer = await downloadSandboxFile(sandbox, remotePath)
      const fileName = sanitizeFileName(pathPosix.basename(remotePath), `artifact-${artifacts.length + 1}`)
      const mimeType = guessMimeType(fileName, artifactBuffer)

      const uploadUrl = await convex.mutation<string>('outputs:generateUploadUrl', {
        userId,
        serverSecret,
      })

      let storageId: string | null = null
      if (uploadUrl) {
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: mimeType ? { 'Content-Type': mimeType } : undefined,
          body: new Uint8Array(artifactBuffer),
        })

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload sandbox artifact "${fileName}" to Convex storage.`)
        }

        const payload = (await uploadResponse.json()) as { storageId: string }
        storageId = payload.storageId
      }

      const type = classifyOutputType(fileName, mimeType)
      const createdOutputId = await convex.mutation<string | null>('outputs:create', {
        userId,
        serverSecret,
        type,
        source: 'sandbox',
        status: 'completed',
        prompt: normalizedTask,
        modelId: 'daytona/default',
        storageId: storageId ?? undefined,
        fileName,
        mimeType,
        sizeBytes: artifactBuffer.byteLength,
        metadata: {
          runtime,
          command: normalizedCommand,
          remotePath,
        },
      })
      if (!createdOutputId) {
        throw new Error(`Failed to create Output record for sandbox artifact "${fileName}".`)
      }

      artifacts.push({
        outputId: createdOutputId,
        fileName,
        mimeType,
        sizeBytes: artifactBuffer.byteLength,
        type,
      })
    }

    const exportSucceeded =
      execution.exitCode === 0 &&
      artifacts.length > 0 &&
      missingExpectedOutputs.length === 0

    return NextResponse.json({
      success: exportSucceeded,
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
      artifacts,
      missingExpectedOutputs,
      uploadedFiles,
      message:
        execution.exitCode === 0
          ? missingExpectedOutputs.length === 0 && artifacts.length > 0
            ? `Sandbox run completed and imported ${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'}.`
            : missingExpectedOutputs.length > 0
            ? `Sandbox run completed, but some declared outputs were missing: ${missingExpectedOutputs.join(', ')}.`
            : 'Sandbox run completed, but no declared output files were found.'
          : `Sandbox run failed with exit code ${execution.exitCode}.`,
    }, {
      status: exportSucceeded ? 200 : 500,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Daytona sandbox execution failed.',
      },
      { status: 500 },
    )
  } finally {
    try {
      await deleteSandbox(sandbox)
    } catch (cleanupError) {
      console.error('[Daytona Sandbox] Cleanup failed:', cleanupError)
    }
  }
}
