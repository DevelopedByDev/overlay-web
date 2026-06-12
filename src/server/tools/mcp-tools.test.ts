import assert from 'node:assert/strict'
import test from 'node:test'
import { rankMcpCatalogEntries } from './mcp-tools'

const entries = [
  {
    serverId: 's1',
    serverName: 'GitHub',
    name: 'create_issue',
    description: 'Create a GitHub issue',
  },
  {
    serverId: 's1',
    serverName: 'GitHub',
    name: 'list_repos',
    description: 'List repositories',
  },
  {
    serverId: 's2',
    serverName: 'Weather',
    name: 'get_forecast',
    description: 'Fetch weather forecast for a city',
  },
]

test('rankMcpCatalogEntries returns prefix of catalog for empty query', () => {
  const ranked = rankMcpCatalogEntries(entries, '', 2)
  assert.equal(ranked.length, 2)
  assert.equal(ranked[0]?.name, 'create_issue')
  assert.equal(ranked[0]?.score, 0)
})

test('rankMcpCatalogEntries prefers exact and name matches', () => {
  const ranked = rankMcpCatalogEntries(entries, 'create issue', 5)
  assert.equal(ranked[0]?.name, 'create_issue')
  assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0))
})

test('rankMcpCatalogEntries matches descriptions and server names', () => {
  const ranked = rankMcpCatalogEntries(entries, 'weather forecast', 5)
  assert.equal(ranked[0]?.name, 'get_forecast')
})
