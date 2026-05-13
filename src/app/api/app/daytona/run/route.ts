import { posix as pathPosix } from 'node:path'
import type { Sandbox } from '@daytonaio/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import {
  accrueWorkspaceSpend,
  downloadSandboxFile,
  ensureWorkspaceSandbox,
  executeSandboxCommand,
  getSandboxPaths,
  prepareSandboxWorkspace,
  refreshWorkspaceActivity,
  startIfNeeded,
  uploadSandboxBuffer,
  type DaytonaRuntime,
} from '@/lib/daytona'
import { computeDaytonaRuntimeCost, getDaytonaResourceProfile } from '@/lib/daytona-pricing'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { classifyOutputType } from '@/lib/output-types'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { getSession } from '@/lib/workos-auth'
import type { Entitlements } from '@/lib/app-contracts'
import {
  buildInsufficientCreditsPayload,
  ensureBudgetAvailable,
  getBudgetTotals,
  isPaidPlan,
  markProviderBudgetReconcile,
  releaseProviderBudgetReservation,
  reserveProviderBudget,
} from '@/lib/billing-runtime'
import { uploadBuffer as uploadBufferToR2, keyForOutput, generatePresignedDownloadUrl, deleteObject } from '@/lib/r2'
import { checkGlobalR2Budget } from '@/lib/r2-budget'

export const maxDuration = 300

interface OverlayFileRecord {
  _id: string
  name: string
  content: string
  storageId?: string | null
  r2Key?: string | null
}

interface SandboxArtifactResponse {
  outputId: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  url?: string
  type: string
}

// LLM-composed commands are structurally untrusted: the agent may have been
// steered by prompt injection in a note, shared doc, or knowledge chunk. We
// cannot sanitize the command string perfectly, so the primary defense is
// Daytona-side isolation (egress allowlist, no secret env, no host access).
// These app-side checks are defense-in-depth: they block obviously-abusive
// payloads before they ever reach the sandbox.
const MAX_COMMAND_LENGTH = 4096
const MAX_EXPECTED_OUTPUTS = 10
const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024

// Target hosts that indicate attempted egress to cloud metadata services or
// RFC1918 / loopback / link-local address space. If any of these appear in a
// command string, something is almost certainly wrong.
const BANNED_COMMAND_HOSTS: RegExp[] = [
  /\b169\.254\./, // AWS/GCP IMDS + link-local
  /\bmetadata\.google\.internal\b/i,
  /\bmetadata\.goog\b/i,
  /\binstance-data\b/i,
  /\b127\.0\.0\.1\b/,
  /\blocalhost\b/i,
  /\b0\.0\.0\.0\b/,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/,
]

function validateSandboxCommand(command: string): { ok: true } | { ok: false; reason: string } {
  if (command.length > MAX_COMMAND_LENGTH) {
    return { ok: false, reason: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters.` }
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(command)) {
    return { ok: false, reason: 'Command contains disallowed control characters.' }
  }
  for (const pattern of BANNED_COMMAND_HOSTS) {
    if (pattern.test(command)) {
      return { ok: false, reason: 'Command references an internal or metadata endpoint.' }
    }
  }
  return { ok: true }
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
  if (file.r2Key) {
    const url = await generatePresignedDownloadUrl(file.r2Key)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download Overlay file "${file.name}" from R2.`)
    }
    return Buffer.from(await response.arrayBuffer())
  }
  if (file.storageId) {
    throw new Error(`Legacy Convex storage imports are disabled for "${file.name}". Re-upload this file to Overlay storage.`)
  }

  return Buffer.from(file.content ?? '', 'utf8')
}

async function waitForSandboxFile(
  sandbox: Sandbox,
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
    conversationId,
    turnId,
    userId: requestedUserId,
    accessToken,
  }: {
    task?: string
    runtime?: DaytonaRuntime
    command?: string
    code?: string
    inputFileIds?: string[]
    expectedOutputs?: string[]
    conversationId?: string
    turnId?: string
    userId?: string
    accessToken?: string
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
  const commandValidation = validateSandboxCommand(command.trim())
  if (!commandValidation.ok) {
    console.warn('[Daytona] rejected command', { reason: commandValidation.reason })
    return NextResponse.json(
      { error: 'invalid_command', message: commandValidation.reason },
      { status: 400 },
    )
  }
  if (!Array.isArray(expectedOutputs) || expectedOutputs.length === 0) {
    return NextResponse.json({ error: 'expectedOutputs must include at least one path' }, { status: 400 })
  }
  if (expectedOutputs.length > MAX_EXPECTED_OUTPUTS) {
    return NextResponse.json({ error: `expectedOutputs cannot exceed ${MAX_EXPECTED_OUTPUTS} paths` }, { status: 400 })
  }

  let userId: string | null = session?.user.id ?? null
  if (!userId) {
    const auth = await resolveAuthenticatedAppUser(request, {
      accessToken,
      userId: requestedUserId,
    })
    userId = auth?.userId ?? null
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimitResponse = await enforceRateLimits(request, [
    { bucket: 'sandbox:daytona:ip', key: getClientIp(request), limit: 20, windowMs: 10 * 60_000 },
    { bucket: 'sandbox:daytona:user', key: userId, limit: 10, windowMs: 10 * 60_000 },
  ])
  if (rateLimitResponse) {
    return rateLimitResponse
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
  if (!isPaidPlan(entitlements)) {
    return NextResponse.json(
      { error: 'sandbox_not_allowed', message: 'Daytona sandbox execution requires a paid plan.' },
      { status: 403 },
    )
  }
  let currentEntitlements = entitlements
  let budget = getBudgetTotals(currentEntitlements)
  if (budget.remainingCents <= 0) {
    const autoTopUp = await ensureBudgetAvailable({
      userId,
      entitlements: currentEntitlements,
      minimumRequiredCents: 1,
    })
    currentEntitlements = autoTopUp.entitlements
    budget = getBudgetTotals(currentEntitlements)
  }
  if (budget.remainingCents <= 0) {
    return NextResponse.json(
      buildInsufficientCreditsPayload(currentEntitlements, 'No budget remaining. Please top up your account.'),
      { status: 402 },
    )
  }

  let workspaceRun:
    | Awaited<ReturnType<typeof ensureWorkspaceSandbox>>
    | null = null
  let meteringStartedAt: number | null = null
  let meteringEndedAt: number | null = null
  let sandboxBudgetReservationId: string | null = null

  const profile = getDaytonaResourceProfile('pro')
  const maxEstimatedRuntime = computeDaytonaRuntimeCost({
    cpu: profile.cpu,
    memoryGiB: profile.memoryGiB,
    diskGiB: profile.diskGiB,
    elapsedSeconds: maxDuration,
  })
  const sandboxReservation = await reserveProviderBudget({
    userId,
    entitlements: currentEntitlements,
    providerCostUsd: maxEstimatedRuntime.costUsd,
    kind: 'sandbox',
    modelId: 'daytona/pro',
  })
  if (!sandboxReservation.ok) {
    return NextResponse.json({ ...sandboxReservation.payload, error: sandboxReservation.code }, { status: sandboxReservation.status })
  }
  sandboxBudgetReservationId = sandboxReservation.reservationId

  try {
    workspaceRun = await ensureWorkspaceSandbox({
      userId,
      tier: 'pro',
    })
    workspaceRun = await startIfNeeded(workspaceRun)
    await refreshWorkspaceActivity(workspaceRun)

    const sandbox = workspaceRun.sandbox
    const paths = await getSandboxPaths(sandbox)
    meteringStartedAt = workspaceRun.workspace.lastMeteredAt ?? Date.now()
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
    const execution = await (async () => {
      try {
        return await executeSandboxCommand(sandbox, {
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
      } finally {
        meteringEndedAt = Date.now()
      }
    })()

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
      if (artifactBuffer.byteLength > MAX_ARTIFACT_BYTES) {
        throw new Error(`Sandbox artifact "${rawExpected}" exceeds the ${MAX_ARTIFACT_BYTES} byte limit.`)
      }
      const fileName = sanitizeFileName(pathPosix.basename(remotePath), `artifact-${artifacts.length + 1}`)
      const mimeType = guessMimeType(fileName, artifactBuffer)

      const type = classifyOutputType(fileName, mimeType)
      const r2Key = keyForOutput(userId, `tmp-${Date.now()}`, fileName)
      await checkGlobalR2Budget(artifactBuffer.byteLength)
      await uploadBufferToR2(r2Key, new Uint8Array(artifactBuffer), mimeType ?? 'application/octet-stream')
      console.log(`[Daytona] Uploaded artifact "${fileName}" (${artifactBuffer.byteLength}B) to R2 key=${r2Key}`)

      let createdOutputId: string | null = null
      try {
        createdOutputId = await convex.mutation<string | null>('outputs:create', {
          userId,
          serverSecret,
          type,
          source: 'sandbox',
          status: 'completed',
          prompt: normalizedTask,
          modelId: 'daytona/default',
          r2Key,
          fileName,
          mimeType,
          sizeBytes: artifactBuffer.byteLength,
          metadata: {
            runtime,
            command: normalizedCommand,
            remotePath,
          },
          ...(conversationId ? { conversationId } : {}),
          ...(turnId ? { turnId } : {}),
        })
      } catch (error) {
        await deleteObject(r2Key).catch(() => {})
        throw error
      }
      if (!createdOutputId) {
        await deleteObject(r2Key).catch(() => {})
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
      sandboxId: sandbox.id,
      workspaceState: workspaceRun.workspace.state,
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
        ...(workspaceRun?.sandbox.id ? { sandboxId: workspaceRun.sandbox.id } : {}),
      },
      { status: 500 },
    )
  } finally {
	    if (workspaceRun && meteringStartedAt != null && meteringEndedAt != null && meteringEndedAt > meteringStartedAt) {
	      try {
	        const meteringResult = await accrueWorkspaceSpend({
	          workspace: workspaceRun.workspace,
	          sandbox: workspaceRun.sandbox,
	          startedAt: meteringStartedAt,
	          endedAt: meteringEndedAt,
	          reason: 'task',
	        })
	        if (sandboxBudgetReservationId && meteringResult?.success) {
	          await releaseProviderBudgetReservation({
	            userId,
	            reservationId: sandboxBudgetReservationId,
	            reason: 'daytona_actual_usage_accrued',
	          }).catch(() => {})
	          sandboxBudgetReservationId = null
	        }
	      } catch (meteringError) {
	        console.error('[Daytona Sandbox] Metering failed:', meteringError)
	        if (sandboxBudgetReservationId) {
	          await markProviderBudgetReconcile({
	            userId,
	            reservationId: sandboxBudgetReservationId,
	            errorMessage: meteringError instanceof Error ? meteringError.message : 'daytona_metering_failed',
	          }).catch(() => {})
	          sandboxBudgetReservationId = null
	        }
	      }
	    }
	    if (sandboxBudgetReservationId) {
	      await releaseProviderBudgetReservation({
	        userId,
	        reservationId: sandboxBudgetReservationId,
	        reason: 'daytona_no_metered_runtime',
	      }).catch(() => {})
	    }
	  }
	}
