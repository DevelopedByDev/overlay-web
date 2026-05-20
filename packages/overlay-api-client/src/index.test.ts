import assert from 'node:assert/strict'
import test from 'node:test'
import { createOverlayAppClient } from './index'

interface RecordedRequest {
  input: RequestInfo | URL
  init?: RequestInit
}

function createRecordedClient() {
  const calls: RecordedRequest[] = []
  const client = createOverlayAppClient({
    baseUrl: 'https://example.test',
    fetch: async (input, init) => {
      calls.push({ input, init })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
    getAuthHeaders: () => ({ Authorization: 'Bearer test' }),
  })
  return { calls, client }
}

async function jsonBody(call: RecordedRequest): Promise<unknown> {
  assert.equal(typeof call.init?.body, 'string')
  return JSON.parse(call.init?.body as string)
}

test('file methods preserve route paths, methods, queries, and JSON bodies', async () => {
  const { calls, client } = createRecordedClient()

  await client.files.uploadUrlResponse({ name: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 42 })
  await client.files.presignResponse({ name: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 42 })
  await client.files.shareResponse({ fileId: 'file_1', visibility: 'public' })
  await client.files.searchTextResponse({ fileIds: ['file_1'], query: 'alpha' })

  assert.equal(String(calls[0]!.input), 'https://example.test/api/v1/files/upload-url')
  assert.equal(calls[0]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[0]!), {
    name: 'plan.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 42,
  })

  assert.equal(
    String(calls[1]!.input),
    'https://example.test/api/v1/files/presign?name=plan.pdf&mimeType=application%2Fpdf&sizeBytes=42',
  )
  assert.equal(calls[1]!.init?.method, undefined)

  assert.equal(String(calls[2]!.input), 'https://example.test/api/v1/files/share')
  assert.equal(calls[2]!.init?.method, 'PATCH')
  assert.deepEqual(await jsonBody(calls[2]!), { fileId: 'file_1', visibility: 'public' })

  assert.equal(String(calls[3]!.input), 'https://example.test/api/v1/files/search-text')
  assert.equal(calls[3]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[3]!), { fileIds: ['file_1'], query: 'alpha' })
})

test('module feature methods use canonical app endpoints', async () => {
  const { calls, client } = createRecordedClient()

  await client.memory.updateResponse({ memoryId: 'mem_1', content: 'Updated' })
  await client.outputs.deleteResponse({ outputId: 'out_1' })
  await client.notes.notebookAgentResponse({
    noteContent: '',
    noteTitle: 'Untitled',
    message: 'summarize this',
  })
  await client.projects.getResponse({ projectId: 'proj_1', includeDeleted: true, updatedSince: 123 })
  await client.integrations.connectResponse({ toolkit: 'github' })
  await client.skills.deleteResponse({ skillId: 'skill_1' })
  await client.mcpServers.testResponse({ url: 'https://mcp.example.test', transport: 'streamable-http' })
  await client.automations.updateResponse({ automationId: 'auto_1', name: 'Renamed' })
  await client.automations.testResponse({ automationId: 'auto_1' })

  assert.equal(String(calls[0]!.input), 'https://example.test/api/v1/memory')
  assert.equal(calls[0]!.init?.method, 'PATCH')
  assert.deepEqual(await jsonBody(calls[0]!), { memoryId: 'mem_1', content: 'Updated' })

  assert.equal(String(calls[1]!.input), 'https://example.test/api/v1/outputs?outputId=out_1')
  assert.equal(calls[1]!.init?.method, 'DELETE')

  assert.equal(String(calls[2]!.input), 'https://example.test/api/v1/notebook-agent')
  assert.equal(calls[2]!.init?.method, 'POST')

  assert.equal(
    String(calls[3]!.input),
    'https://example.test/api/v1/projects?projectId=proj_1&includeDeleted=true&updatedSince=123',
  )

  assert.equal(String(calls[4]!.input), 'https://example.test/api/v1/integrations')
  assert.equal(calls[4]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[4]!), { toolkit: 'github', action: 'connect' })

  assert.equal(String(calls[5]!.input), 'https://example.test/api/v1/skills?skillId=skill_1')
  assert.equal(calls[5]!.init?.method, 'DELETE')

  assert.equal(String(calls[6]!.input), 'https://example.test/api/v1/mcps/test')
  assert.equal(calls[6]!.init?.method, 'POST')

  assert.equal(String(calls[7]!.input), 'https://example.test/api/v1/automations')
  assert.equal(calls[7]!.init?.method, 'PATCH')
  assert.deepEqual(await jsonBody(calls[7]!), { automationId: 'auto_1', name: 'Renamed' })

  assert.equal(String(calls[8]!.input), 'https://example.test/api/v1/automations/test')
  assert.equal(calls[8]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[8]!), { automationId: 'auto_1' })
})

test('settings and account methods preserve billing/auth route contracts', async () => {
  const { calls, client } = createRecordedClient()

  await client.account.entitlementsResponse()
  await client.account.desktopLinkResponse({ codeChallenge: 'challenge', chromeExtensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
  await client.billing.portalResponse({ sessionId: 'cs_123' })
  await client.billing.verifyCheckoutResponse({ sessionId: 'cs_123' })
  await client.subscription.updateSettingsResponse({
    autoTopUpEnabled: true,
    topUpAmountCents: 1200,
    grantOffSessionConsent: true,
  })
  await client.topUps.historyResponse()
  await client.topUps.checkoutResponse({ amountCents: 1200, autoTopUpEnabled: true, returnPath: '/account' })
  await client.topUps.verifyResponse({ sessionId: 'cs_topup' })

  assert.equal(String(calls[0]!.input), 'https://example.test/api/entitlements')

  assert.equal(String(calls[1]!.input), 'https://example.test/api/auth/desktop-link')
  assert.equal(calls[1]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[1]!), {
    codeChallenge: 'challenge',
    chromeExtensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  })

  assert.equal(String(calls[2]!.input), 'https://example.test/api/portal')
  assert.equal(calls[2]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[2]!), { sessionId: 'cs_123' })

  assert.equal(String(calls[3]!.input), 'https://example.test/api/checkout/verify')
  assert.equal(calls[3]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[3]!), { sessionId: 'cs_123' })

  assert.equal(String(calls[4]!.input), 'https://example.test/api/subscription/settings')
  assert.equal(calls[4]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[4]!), {
    autoTopUpEnabled: true,
    topUpAmountCents: 1200,
    grantOffSessionConsent: true,
  })

  assert.equal(String(calls[5]!.input), 'https://example.test/api/topups/history')

  assert.equal(String(calls[6]!.input), 'https://example.test/api/topups/checkout')
  assert.equal(calls[6]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[6]!), {
    amountCents: 1200,
    autoTopUpEnabled: true,
    returnPath: '/account',
  })

  assert.equal(String(calls[7]!.input), 'https://example.test/api/topups/verify')
  assert.equal(calls[7]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[7]!), { sessionId: 'cs_topup' })
})
