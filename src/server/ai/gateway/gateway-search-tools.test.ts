import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildParallelProviderPayload,
  buildPerplexityProviderPayload,
} from './gateway-search-tools'

test('buildPerplexityProviderPayload preserves default provider payload shape', () => {
  assert.deepEqual(buildPerplexityProviderPayload({ query: 'overlay architecture' }), {
    query: 'overlay architecture',
    max_results: 10,
    max_tokens_per_page: 2048,
    max_tokens: 50_000,
    search_recency_filter: 'year',
  })
})

test('buildPerplexityProviderPayload omits recency when explicit date filters exist', () => {
  assert.deepEqual(buildPerplexityProviderPayload({
    query: ['alpha', 'beta'],
    maxResults: 3,
    country: 'US',
    searchDomainFilter: ['arxiv.org'],
    searchAfterDate: '01/01/2026',
    searchRecencyFilter: 'day',
  }), {
    query: ['alpha', 'beta'],
    max_results: 3,
    max_tokens_per_page: 2048,
    max_tokens: 50_000,
    country: 'US',
    search_domain_filter: ['arxiv.org'],
    search_after_date: '01/01/2026',
  })
})

test('buildParallelProviderPayload preserves default excerpts and optional policies', () => {
  assert.deepEqual(buildParallelProviderPayload({
    objective: 'find primary sources',
    searchQueries: ['overlay on prem'],
    includeDomains: ['docs.example.com'],
    excludeDomains: ['reddit.com'],
    afterDate: '2026-01-01',
    maxAgeSeconds: 60,
  }), {
    objective: 'find primary sources',
    mode: 'one-shot',
    max_results: 10,
    search_queries: ['overlay on prem'],
    source_policy: {
      include_domains: ['docs.example.com'],
      exclude_domains: ['reddit.com'],
      after_date: '2026-01-01',
    },
    excerpts: {
      max_chars_per_result: 5000,
      max_chars_total: 80_000,
    },
    fetch_policy: { max_age_seconds: 60 },
  })
})
