import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { deriveOverlayCapabilities } from '@overlay/app-core'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { convex } from '@/server/database/convex'
import { fileService } from '@/server/files/http'

const originalNextPhase = process.env.NEXT_PHASE
const originalInternalApiSecret = process.env.INTERNAL_API_SECRET
process.env.NEXT_PHASE = 'phase-production-build'
process.env.INTERNAL_API_SECRET = 'test-internal-secret'
test.after(() => {
  if (originalNextPhase === undefined) {
    delete process.env.NEXT_PHASE
  } else {
    process.env.NEXT_PHASE = originalNextPhase
  }
  if (originalInternalApiSecret === undefined) {
    delete process.env.INTERNAL_API_SECRET
  } else {
    process.env.INTERNAL_API_SECRET = originalInternalApiSecret
  }
})

function request(path: string, init: {
  body?: BodyInit | null
  headers?: HeadersInit
  method?: string
} = {}): NextRequest {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return new NextRequest(`https://overlay.test${path}`, {
    body: init.body,
    headers,
    method: init.method,
  })
}

function context(): AppApiRouteContext {
  return {
    auth: {
      userId: 'user_1',
      accessToken: 'access_token',
      authType: 'session',
    },
    capabilities: deriveOverlayCapabilities(),
    params: Promise.resolve({}),
    parsedFormData: null,
    parsedJson: {},
    parsedQuery: {},
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json()
}

test('files POST route preserves success response shape', async (t) => {
  t.mock.method(fileService, 'createFile', async () => ({ id: 'file_1', ids: undefined, parts: undefined }))
  const route = await import('./files/route')
  const response = await route.POST(
    request('/api/v1/files', {
      method: 'POST',
      body: JSON.stringify({ name: 'x.txt' }),
    }),
    context(),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await readJson(response), { id: 'file_1' })
})

test('files upload-url and presign routes preserve success response shapes', async (t) => {
  t.mock.method(fileService, 'createUploadUrl', async () => ({
    uploadUrl: 'https://upload.test/file',
    r2Key: 'users/user_1/files/tmp/file.txt',
    expiresIn: 900,
    maxSizeBytes: 123,
  }))
  t.mock.method(fileService, 'createPresignedUpload', async () => ({
    presignedUrl: 'https://upload.test/presign',
    r2Key: 'users/user_1/files/tmp/presign.txt',
    expiresIn: 900,
    maxSizeBytes: 456,
  }))

  const uploadRoute = await import('./files/upload-url/route')
  const presignRoute = await import('./files/presign/route')

  const uploadResponse = await uploadRoute.POST(
    request('/api/v1/files/upload-url', {
      method: 'POST',
      body: JSON.stringify({ name: 'file.txt', sizeBytes: 123 }),
    }),
    context(),
  )
  assert.equal(uploadResponse.status, 200)
  assert.deepEqual(await readJson(uploadResponse), {
    uploadUrl: 'https://upload.test/file',
    r2Key: 'users/user_1/files/tmp/file.txt',
    expiresIn: 900,
    maxSizeBytes: 123,
  })

  const presignResponse = await presignRoute.GET(
    request('/api/v1/files/presign?name=presign.txt&sizeBytes=456', { method: 'GET' }),
    context(),
  )
  assert.equal(presignResponse.status, 200)
  assert.deepEqual(await readJson(presignResponse), {
    presignedUrl: 'https://upload.test/presign',
    r2Key: 'users/user_1/files/tmp/presign.txt',
    expiresIn: 900,
    maxSizeBytes: 456,
  })
})

test('files DELETE route preserves success response shape', async (t) => {
  t.mock.method(fileService, 'deleteFile', async () => ({ success: true as const }))
  const route = await import('./files/route')
  const response = await route.DELETE(
    request('/api/v1/files?fileId=file_1', { method: 'DELETE' }),
    context(),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await readJson(response), { success: true })
})

test('files DELETE route preserves missing fileId error shape', async () => {
  const route = await import('./files/route')
  const response = await route.DELETE(request('/api/v1/files', { method: 'DELETE' }), context())

  assert.equal(response.status, 400)
  assert.deepEqual(await readJson(response), { error: 'fileId required' })
})

test('automations GET route preserves list response shape', async (t) => {
  t.mock.method(convex, 'query', async (path: string) => {
    assert.equal(path, 'automations/automations:list')
    return []
  })
  const route = await import('./automations/route')
  const response = await route.GET(request('/api/v1/automations', { method: 'GET' }), context())

  assert.equal(response.status, 200)
  assert.deepEqual(await readJson(response), [])
})

test('automations create/update/test/run preserve validation and auth error shapes', async () => {
  const automations = await import('./automations/route')
  const testRoute = await import('./automations/test/route')
  const runRoute = await import('./automations/run/route')

  const createResponse = await automations.POST(
    request('/api/v1/automations', { method: 'POST', body: JSON.stringify({}) }),
    context(),
  )
  assert.equal(createResponse.status, 400)
  assert.deepEqual(await readJson(createResponse), {
    error: 'name, description, instructions, and schedule are required',
  })

  const updateResponse = await automations.PATCH(
    request('/api/v1/automations', { method: 'PATCH', body: JSON.stringify({}) }),
    context(),
  )
  assert.equal(updateResponse.status, 400)
  assert.deepEqual(await readJson(updateResponse), { error: 'automationId required' })

  const testResponse = await testRoute.POST(
    request('/api/v1/automations/test', { method: 'POST', body: JSON.stringify({}) }),
    context(),
  )
  assert.equal(testResponse.status, 400)
  assert.deepEqual(await readJson(testResponse), { error: 'automationId required' })

  const runResponse = await runRoute.POST(
    request('/api/v1/automations/run', { method: 'POST', body: JSON.stringify({ runId: 'run_1' }) }),
  )
  assert.equal(runResponse.status, 401)
  assert.deepEqual(await readJson(runResponse), { error: 'Unauthorized' })
})

test('billing customer routes preserve unauthenticated/invalid body response shapes', async (t) => {
  const { getOverlayServerContext } = await import('@/server/bootstrap')
  const context = getOverlayServerContext()
  t.mock.method(context.auth, 'getSession', async () => null)
  t.mock.method(context.auth, 'verifyAccessToken', async () => null)

  const subscription = await import('@/app/api/subscription/route')
  const settings = await import('@/app/api/subscription/settings/route')
  const checkout = await import('@/app/api/checkout/route')
  const topupHistory = await import('@/app/api/topups/history/route')
  const topupCheckout = await import('@/app/api/topups/checkout/route')
  const topupVerify = await import('@/app/api/topups/verify/route')
  const portal = await import('@/app/api/portal/route')
  const entitlements = await import('@/app/api/entitlements/route')

  const subscriptionResponse = await subscription.GET(request('/api/subscription?userId=user_1', { method: 'GET' }))
  assert.equal(subscriptionResponse.status, 401)
  assert.deepEqual(await readJson(subscriptionResponse), { error: 'Authentication required' })

  const settingsResponse = await settings.POST(
    request('/api/subscription/settings', { method: 'POST', body: 'null' }),
  )
  assert.equal(settingsResponse.status, 400)
  assert.deepEqual(await readJson(settingsResponse), { error: 'Invalid request body' })

  const checkoutResponse = await checkout.POST(
    request('/api/checkout', { method: 'POST', body: JSON.stringify({}) }),
  )
  assert.equal(checkoutResponse.status, 401)
  assert.deepEqual(await readJson(checkoutResponse), {
    error: 'Authentication required. Please sign in to subscribe.',
  })

  const topupHistoryResponse = await topupHistory.GET(request('/api/topups/history', { method: 'GET' }))
  assert.equal(topupHistoryResponse.status, 401)
  assert.deepEqual(await readJson(topupHistoryResponse), { error: 'Authentication required' })

  const topupCheckoutResponse = await topupCheckout.POST(
    request('/api/topups/checkout', { method: 'POST', body: JSON.stringify({}) }),
  )
  assert.equal(topupCheckoutResponse.status, 401)
  assert.deepEqual(await readJson(topupCheckoutResponse), { error: 'Authentication required' })

  const topupVerifyResponse = await topupVerify.POST(
    request('/api/topups/verify', { method: 'POST', body: JSON.stringify({ sessionId: 'cs_test_123' }) }),
  )
  assert.equal(topupVerifyResponse.status, 401)
  assert.deepEqual(await readJson(topupVerifyResponse), { error: 'Authentication required' })

  const portalResponse = await portal.POST(
    request('/api/portal', { method: 'POST', body: JSON.stringify({}) }),
  )
  assert.equal(portalResponse.status, 401)
  assert.deepEqual(await readJson(portalResponse), { error: 'Authentication required' })

  const entitlementsResponse = await entitlements.GET()
  assert.equal(entitlementsResponse.status, 401)
  assert.deepEqual(await readJson(entitlementsResponse), { error: 'Unauthorized' })
})

test('conversations act preserves premium gating response shape for free users', async (t) => {
  t.mock.method(convex, 'query', async (path: string) => {
    if (path === 'platform/usage:getEntitlementsByServer') {
      return {
        tier: 'free',
        planKind: 'free',
        creditsUsed: 0,
        creditsTotal: 0,
        budgetUsedCents: 0,
        budgetTotalCents: 0,
        budgetRemainingCents: 0,
      }
    }
    if (path === 'platform/uiSettings:getByServer') {
      return null
    }
    throw new Error(`Unexpected Convex query: ${path}`)
  })

  const route = await import('./conversations/act/route')
  const response = await route.POST(
    request('/api/v1/conversations/act', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
        modelId: 'claude-sonnet-4-6',
      }),
    }),
    context(),
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await readJson(response), {
    error: 'premium_model_not_allowed',
    message: 'Free tier is limited to free models. Upgrade to a paid plan to use premium models.',
  })
})

test('conversations act swallows user-message persistence failure before later fatal preparation errors', async (t) => {
  let sawUserMessagePersist = false
  t.mock.method(convex, 'query', async (path: string) => {
    if (path === 'platform/usage:getEntitlementsByServer') {
      return {
        tier: 'free',
        planKind: 'free',
        creditsUsed: 0,
        creditsTotal: 0,
        budgetUsedCents: 0,
        budgetTotalCents: 0,
        budgetRemainingCents: 0,
      }
    }
    if (path === 'platform/uiSettings:getByServer') return null
    if (path === 'knowledge/memories:list') return []
    if (path === 'integrations/skills:list') return []
    if (path === 'integrations/mcpServers:listEnabled') return []
    if (path === 'chat/conversations:get') return null
    if (path === 'chat/conversations:getMessages') {
      throw new Error('history unavailable')
    }
    throw new Error(`Unexpected Convex query: ${path}`)
  })
  t.mock.method(convex, 'mutation', async (path: string) => {
    if (path === 'chat/conversations:addMessage') {
      sawUserMessagePersist = true
      throw new Error('user message persistence failed')
    }
    throw new Error(`Unexpected Convex mutation: ${path}`)
  })

  const route = await import('./conversations/act/route')
  const response = await route.POST(
    request('/api/v1/conversations/act', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'conversation_1',
        turnId: 'turn_1',
        messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
        modelId: 'openrouter/free',
      }),
    }),
    context(),
  )

  assert.equal(sawUserMessagePersist, true)
  assert.equal(response.status, 500)
  assert.deepEqual(await readJson(response), { error: 'history unavailable' })
})
