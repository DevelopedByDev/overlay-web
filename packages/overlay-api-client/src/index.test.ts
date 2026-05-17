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

  assert.equal(String(calls[0]!.input), 'https://example.test/api/app/files/upload-url')
  assert.equal(calls[0]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[0]!), {
    name: 'plan.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 42,
  })

  assert.equal(
    String(calls[1]!.input),
    'https://example.test/api/app/files/presign?name=plan.pdf&mimeType=application%2Fpdf&sizeBytes=42',
  )
  assert.equal(calls[1]!.init?.method, undefined)

  assert.equal(String(calls[2]!.input), 'https://example.test/api/app/files/share')
  assert.equal(calls[2]!.init?.method, 'PATCH')
  assert.deepEqual(await jsonBody(calls[2]!), { fileId: 'file_1', visibility: 'public' })

  assert.equal(String(calls[3]!.input), 'https://example.test/api/app/files/search-text')
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

  assert.equal(String(calls[0]!.input), 'https://example.test/api/app/memory')
  assert.equal(calls[0]!.init?.method, 'PATCH')
  assert.deepEqual(await jsonBody(calls[0]!), { memoryId: 'mem_1', content: 'Updated' })

  assert.equal(String(calls[1]!.input), 'https://example.test/api/app/outputs?outputId=out_1')
  assert.equal(calls[1]!.init?.method, 'DELETE')

  assert.equal(String(calls[2]!.input), 'https://example.test/api/app/notebook-agent')
  assert.equal(calls[2]!.init?.method, 'POST')

  assert.equal(
    String(calls[3]!.input),
    'https://example.test/api/app/projects?projectId=proj_1&includeDeleted=true&updatedSince=123',
  )

  assert.equal(String(calls[4]!.input), 'https://example.test/api/app/integrations')
  assert.equal(calls[4]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[4]!), { toolkit: 'github', action: 'connect' })

  assert.equal(String(calls[5]!.input), 'https://example.test/api/app/skills?skillId=skill_1')
  assert.equal(calls[5]!.init?.method, 'DELETE')

  assert.equal(String(calls[6]!.input), 'https://example.test/api/app/mcps/test')
  assert.equal(calls[6]!.init?.method, 'POST')
})

test('top-up methods preserve account billing endpoints and JSON bodies', async () => {
  const { calls, client } = createRecordedClient()

  await client.topUps.checkoutResponse({
    amountCents: 800,
    autoTopUpEnabled: true,
    returnPath: '/app/chat',
  })
  await client.topUps.verifyResponse({ sessionId: 'cs_test_123' })

  assert.equal(String(calls[0]!.input), 'https://example.test/api/topups/checkout')
  assert.equal(calls[0]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[0]!), {
    amountCents: 800,
    autoTopUpEnabled: true,
    returnPath: '/app/chat',
  })

  assert.equal(String(calls[1]!.input), 'https://example.test/api/topups/verify')
  assert.equal(calls[1]!.init?.method, 'POST')
  assert.deepEqual(await jsonBody(calls[1]!), { sessionId: 'cs_test_123' })
})
