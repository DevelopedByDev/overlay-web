import assert from 'node:assert/strict'
import test from 'node:test'
import type { ToolSet } from '@/server/ai/sdk'
import { buildActTooling } from './tooling'

const toolSet = (tools: Record<string, object>): ToolSet => tools as unknown as ToolSet

test('buildActTooling preserves paid primary tool composition', () => {
  const tooling = buildActTooling({
    allowedOverlayToolIds: ['generate_image'],
    composioRaw: toolSet({ GMAIL_SEND_EMAIL: {}, BROWSER_NAVIGATE: {} }),
    isMultiModelFollowUpSlot: false,
    mcpToolsRaw: toolSet({ mcp_search: {} }),
    paid: true,
    parallelTool: {} as ToolSet[string],
    perplexityTool: {} as ToolSet[string],
    webToolSet: toolSet({ generate_image: {}, save_memory: {} }),
  })

  assert.deepEqual(tooling.allowedOverlayToolIds, ['generate_image'])
  assert.equal(tooling.gatewaySearchLog, 'perplexity:yes parallel:yes')
  assert.equal(tooling.missingGatewaySearchTools, false)
  assert.deepEqual(tooling.exposedMediaTools, ['generate_image'])
  assert.deepEqual(Object.keys(tooling.tools).sort(), [
    'BROWSER_NAVIGATE',
    'GMAIL_SEND_EMAIL',
    'generate_image',
    'mcp_search',
    'parallel_search',
    'perplexity_search',
    'save_memory',
  ])
})

test('buildActTooling preserves free-tier and compare-slot stripping behavior', () => {
  const freePrimary = buildActTooling({
    allowedOverlayToolIds: [],
    composioRaw: toolSet({ GMAIL_SEND_EMAIL: {}, BROWSER_NAVIGATE: {} }),
    isMultiModelFollowUpSlot: false,
    mcpToolsRaw: toolSet({ mcp_search: {} }),
    paid: false,
    parallelTool: null,
    perplexityTool: null,
    webToolSet: toolSet({ save_memory: {} }),
  })
  assert.equal('GMAIL_SEND_EMAIL' in freePrimary.tools, true)
  assert.equal('BROWSER_NAVIGATE' in freePrimary.tools, false)
  assert.equal('mcp_search' in freePrimary.tools, true)
  assert.equal('perplexity_search' in freePrimary.tools, true)
  assert.equal('parallel_search' in freePrimary.tools, true)
  assert.equal('run_daytona_sandbox' in freePrimary.tools, true)

  const compareSlot = buildActTooling({
    allowedOverlayToolIds: [],
    composioRaw: toolSet({ GMAIL_SEND_EMAIL: {} }),
    isMultiModelFollowUpSlot: true,
    mcpToolsRaw: toolSet({ mcp_search: {} }),
    paid: true,
    parallelTool: {} as ToolSet[string],
    perplexityTool: {} as ToolSet[string],
    webToolSet: toolSet({ save_memory: {} }),
  })
  assert.equal('GMAIL_SEND_EMAIL' in compareSlot.tools, false)
  assert.equal('mcp_search' in compareSlot.tools, false)
  assert.equal('save_memory' in compareSlot.tools, true)
  assert.equal('perplexity_search' in compareSlot.tools, true)
})
