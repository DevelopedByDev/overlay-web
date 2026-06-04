import 'server-only'

import assert from 'node:assert/strict'
import test from 'node:test'

import { getGatewayModelId } from './gateway-runtime'

test('maps app-facing chat model ids to canonical Vercel AI Gateway ids', () => {
  assert.equal(getGatewayModelId('claude-sonnet-4-6'), 'anthropic/claude-sonnet-4.6')
  assert.equal(getGatewayModelId('claude-haiku-4-5'), 'anthropic/claude-haiku-4.5')
  assert.equal(getGatewayModelId('gemini-3-flash-preview'), 'google/gemini-3-flash')
  assert.equal(getGatewayModelId('gpt-4.1-2025-04-14'), 'openai/gpt-4.1')
})

test('keeps already canonical gateway ids unchanged', () => {
  assert.equal(getGatewayModelId('anthropic/claude-opus-4.7'), 'anthropic/claude-opus-4.7')
  assert.equal(getGatewayModelId('moonshotai/kimi-k2.6'), 'moonshotai/kimi-k2.6')
})

test('maps legacy model ids through the current catalog before routing', () => {
  assert.equal(getGatewayModelId('claude-opus-4-6'), 'anthropic/claude-opus-4.7')
})
