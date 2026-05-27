import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/server/database/convex'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import {
  connectedAccountSlug,
  getComposioApiKey,
  hasConnectedToolkit,
  loadComposioSDK,
  normalizeComposioSlug,
  requireProjectComposioEntity,
} from '@/server/tools/composio-server'
import { fireAndForgetRecordToolInvocation } from '@/server/tools/tools/record-tool-invocation'
import { enforceRateLimits, getClientIp } from '@/server/security/rate-limit'
import {
  GMAIL_SEND_TOOL_SLUG,
  GMAIL_TOOLKIT_VERSION,
  buildChatActionIdempotencyKey,
  buildComposioGmailSendArguments,
  normalizeGmailSendValues,
  type GmailSendActionDescriptor,
} from '@/server/chat-actions/gmail-send'
import { summarizeErrorForLog } from '@/shared/security/safe-log'
import type { Id } from '../../../../../../../convex/_generated/dataModel'

type SendBody = {
  conversationId?: string
  assistantMessageId?: string
  dataPartId?: string
  actionId?: string
  values?: Record<string, unknown>
}

function badRequest(message: string) {
  return NextResponse.json({ error: 'bad_request', message }, { status: 400 })
}

function responseForError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error || 'Request failed')
  return NextResponse.json({ error: 'gmail_send_failed', message }, { status })
}

async function gmailConnected(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composio: any,
  entityId: string,
): Promise<boolean> {
  if (await hasConnectedToolkit(composio, entityId, 'gmail')) return true

  try {
    const response = await composio.connectedAccounts.list({
      userIds: [entityId],
      toolkitSlugs: ['gmail'],
    })
    const accounts = Array.isArray(response?.items) ? response.items : []
    return accounts.some(
      (account: unknown) =>
        normalizeComposioSlug(
          connectedAccountSlug(account as Parameters<typeof connectedAccountSlug>[0]) ?? '',
        ) === 'gmail',
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimits(request, [
    { bucket: 'gmail-chat-action-ip', key: getClientIp(request), limit: 30, windowMs: 60_000 },
  ])
  if (rateLimitResponse) return rateLimitResponse

  let body: SendBody
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversationId = body.conversationId?.trim()
  const assistantMessageId = body.assistantMessageId?.trim()
  const dataPartId = body.dataPartId?.trim()
  const actionId = body.actionId?.trim()
  if (!conversationId || !assistantMessageId || !dataPartId || !actionId) {
    return badRequest('conversationId, assistantMessageId, dataPartId, and actionId are required')
  }
  const values = body.values && typeof body.values === 'object' ? body.values : {}

  const serverSecret = getInternalApiSecret()
  let action: GmailSendActionDescriptor | null = null
  let projectId = ''
  let executionId: Id<'chatActionExecutions'> | undefined
  let normalizedInput: ReturnType<typeof normalizeGmailSendValues> | null = null
  const startMs = Date.now()

  try {
    const context = await convex.query<{
      projectId: string
      action: GmailSendActionDescriptor
      actionResult?: { status?: string; message?: string } | null
    }>('chat/conversations:getChatActionContext', {
      conversationId: conversationId as Id<'conversations'>,
      assistantMessageId: assistantMessageId as Id<'conversationMessages'>,
      dataPartId,
      actionId,
      userId: auth.userId,
      serverSecret,
    })
    if (!context) throw new Error('Chat action not found')

    action = context.action
    projectId = context.projectId
    if (context.actionResult?.status === 'succeeded') {
      return NextResponse.json({
        success: true,
        status: 'succeeded',
        duplicate: true,
        message: context.actionResult.message ?? 'Sent',
      })
    }
    normalizedInput = normalizeGmailSendValues(action, values)
    const idempotency = buildChatActionIdempotencyKey({
      userId: auth.userId,
      conversationId,
      assistantMessageId,
      dataPartId,
      actionId,
      normalizedInput,
    })

    const started = await convex.mutation<{
      status: 'started' | 'duplicate' | 'running'
      projectId: string
      action: GmailSendActionDescriptor
      executionId?: Id<'chatActionExecutions'>
      resultSummary?: string
    }>('chat/conversations:startChatActionExecution', {
      conversationId: conversationId as Id<'conversations'>,
      assistantMessageId: assistantMessageId as Id<'conversationMessages'>,
      dataPartId,
      actionId,
      idempotencyKey: idempotency.idempotencyKey,
      inputHash: idempotency.inputHash,
      userId: auth.userId,
      serverSecret,
    })
    if (!started) throw new Error('Chat action execution could not be started')

    action = started.action
    projectId = started.projectId
    executionId = started.executionId

    if (started.status === 'duplicate') {
      return NextResponse.json({
        success: true,
        status: 'succeeded',
        duplicate: true,
        message: started.resultSummary ?? 'Sent',
      })
    }
    if (started.status === 'running') {
      return NextResponse.json({ success: false, status: 'running', message: 'Send already in progress' }, { status: 409 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status =
      /Unauthorized/i.test(message) ? 403 :
      /Project-scoped conversation required/i.test(message) ? 400 :
      /not found/i.test(message) ? 404 :
      400
    return NextResponse.json({ error: 'chat_action_invalid', message }, { status })
  }

  if (!action || !normalizedInput || !projectId) {
    return NextResponse.json({ error: 'chat_action_invalid', message: 'Chat action not found' }, { status: 404 })
  }
  if (!executionId) {
    return NextResponse.json(
      { error: 'chat_action_invalid', message: 'Chat action execution could not be started' },
      { status: 409 },
    )
  }

  const projectAccess = await requireProjectComposioEntity(projectId, auth.userId)
  if (!projectAccess.ok) return projectAccess.response

  const apiKey = await getComposioApiKey(auth.accessToken)
  if (!apiKey) {
    await markExecutionFailed(executionId, auth.userId, 'Composio is not configured.', serverSecret)
    return NextResponse.json(
      { error: 'composio_not_configured', message: 'Composio is not configured.' },
      { status: 409 },
    )
  }

  try {
    const composio = await loadComposioSDK(apiKey)
    const connected = await gmailConnected(composio, projectAccess.entityId)
    if (!connected) {
      await markExecutionFailed(executionId, auth.userId, 'Connect Gmail before sending.', serverSecret)
      return NextResponse.json(
        {
          error: 'gmail_not_connected',
          message: 'Connect Gmail in this project before sending.',
          toolkit: 'gmail',
        },
        { status: 409 },
      )
    }

    const args = buildComposioGmailSendArguments(normalizedInput)
    const result = await composio.tools.execute(GMAIL_SEND_TOOL_SLUG, {
      userId: projectAccess.entityId,
      version: GMAIL_TOOLKIT_VERSION,
      arguments: args,
    })

    const successful = result?.successful !== false && !result?.error
    if (!successful) {
      const errorMessage = typeof result?.error === 'string' ? result.error : 'Gmail send failed.'
      throw new Error(errorMessage)
    }

    await convex.mutation('chat/conversations:finishChatActionExecution', {
      executionId,
      userId: auth.userId,
      status: 'succeeded',
      resultSummary: 'Sent',
      serverSecret,
    })
    fireAndForgetRecordToolInvocation({
      serverSecret,
      userId: auth.userId,
      toolName: GMAIL_SEND_TOOL_SLUG,
      mode: 'act',
      conversationId,
      success: true,
      durationMs: Date.now() - startMs,
    })

    return NextResponse.json({ success: true, status: 'succeeded', message: 'Sent' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail send failed.'
    await markExecutionFailed(executionId, auth.userId, message, serverSecret)
    fireAndForgetRecordToolInvocation({
      serverSecret,
      userId: auth.userId,
      toolName: GMAIL_SEND_TOOL_SLUG,
      mode: 'act',
      conversationId,
      success: false,
      durationMs: Date.now() - startMs,
      error,
    })
    console.error('[chat-actions/gmail/send] failed:', summarizeErrorForLog(error))
    return responseForError(error, 500)
  }
}

async function markExecutionFailed(
  executionId: Id<'chatActionExecutions'> | undefined,
  userId: string,
  errorMessage: string,
  serverSecret: string,
) {
  if (!executionId) return
  await convex.mutation('chat/conversations:finishChatActionExecution', {
    executionId,
    userId,
    status: 'failed',
    errorMessage,
    serverSecret,
  }).catch((error) => {
    console.error('[chat-actions/gmail/send] failed to persist action failure:', summarizeErrorForLog(error))
  })
}
