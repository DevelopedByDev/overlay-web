import assert from 'node:assert/strict'
import test from 'node:test'
import { asSchema } from 'ai'
import { buildOverlayToolSet } from './build'

function buildTestTools() {
  return buildOverlayToolSet({
    userId: 'user-test',
    serverSecret: 'secret-test',
    baseUrl: 'http://localhost:3000',
    allowedToolIds: [],
    includePaidOnlyOverlayTools: true,
    memoryEnabled: true,
  })
}

test('present_generated_ui exposes a Gateway-compatible object schema', async () => {
  const tools = buildTestTools()
  const schema = await asSchema(tools.present_generated_ui.inputSchema).jsonSchema as {
    anyOf?: unknown
    oneOf?: unknown
    type?: unknown
  }

  assert.equal(schema.type, 'object')
  assert.equal(schema.anyOf, undefined)
  assert.equal(schema.oneOf, undefined)
})

test('present_generated_ui still validates variant-specific required fields', async () => {
  const tools = buildTestTools()
  const inputSchema = tools.present_generated_ui.inputSchema as {
    safeParse(input: unknown): { success: boolean }
  }

  assert.equal(inputSchema.safeParse({ kind: 'draft.email', body: 'Missing subject' }).success, false)
  assert.equal(inputSchema.safeParse({ kind: 'draft.text', body: 'Draft body' }).success, true)
})
