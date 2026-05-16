import test from 'node:test'
import assert from 'node:assert/strict'

const { MCP_CATALOG } = await import(new URL('./mcp-catalog.ts', import.meta.url).href)

const transports = new Set(['sse', 'streamable-http'])
const authTypes = new Set(['none', 'bearer', 'header'])

test('MCP catalog entries have required fields and unique ids', () => {
  assert.ok(MCP_CATALOG.length >= 5)

  const ids = new Set<string>()
  for (const entry of MCP_CATALOG) {
    assert.equal(typeof entry.id, 'string')
    assert.ok(entry.id.length > 0)
    assert.equal(ids.has(entry.id), false, `duplicate catalog id: ${entry.id}`)
    ids.add(entry.id)

    assert.equal(typeof entry.name, 'string')
    assert.ok(entry.name.length > 0)
    assert.equal(typeof entry.description, 'string')
    assert.ok(entry.description.length > 0)
    assert.equal(typeof entry.category, 'string')
    assert.ok(entry.category.length > 0)
  }
})

test('MCP catalog URLs are well formed HTTPS URLs', () => {
  for (const entry of MCP_CATALOG) {
    const url = new URL(entry.urlTemplate)
    assert.equal(url.protocol, 'https:')

    const docsUrl = new URL(entry.docsUrl)
    assert.equal(docsUrl.protocol, 'https:')
  }
})

test('MCP catalog transport and auth shape match stored MCP servers', () => {
  for (const entry of MCP_CATALOG) {
    assert.equal(transports.has(entry.transport), true, `${entry.id} has unsupported transport`)
    assert.equal(authTypes.has(entry.defaultAuthType), true, `${entry.id} has unsupported auth type`)
    assert.equal(typeof entry.authPlaceholder, 'string')
    assert.ok(entry.authPlaceholder.length > 0)

    if (entry.defaultAuthType === 'bearer') {
      assert.match(entry.authPlaceholder.toLowerCase(), /token|key/)
    }
  }
})
