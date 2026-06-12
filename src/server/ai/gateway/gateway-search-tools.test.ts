import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExactEntityFallbackPlan,
  buildParallelProviderPayload,
  buildPerplexityProviderPayload,
  filterExactEntityResults,
  hasExactEntityMatch,
  mergeExactEntityFallbackResults,
} from './gateway-search-tools'

test('buildPerplexityProviderPayload preserves default provider payload shape', () => {
  assert.deepEqual(buildPerplexityProviderPayload({ query: 'overlay architecture' }), {
    query: 'overlay architecture',
    max_results: 10,
    max_tokens_per_page: 2048,
    max_tokens: 50_000,
  })
})

test('buildPerplexityProviderPayload includes explicit recency without a date range', () => {
  assert.deepEqual(buildPerplexityProviderPayload({
    query: 'latest overlay news',
    searchRecencyFilter: 'week',
  }), {
    query: 'latest overlay news',
    max_results: 10,
    max_tokens_per_page: 2048,
    max_tokens: 50_000,
    search_recency_filter: 'week',
  })
})

test('buildPerplexityProviderPayload omits explicit recency when date filters exist', () => {
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

test('exact entity fallback plan targets a named person lookup', () => {
  assert.deepEqual(buildExactEntityFallbackPlan('Who is Dr. Sudama Lalwani?', 'IN'), {
    label: 'Dr. Sudama Lalwani',
    identityTerms: ['sudama', 'lalwani'],
    objective:
      'Identify the exact person or entity named "Dr. Sudama Lalwani" and return authoritative profile details. ' +
      'Exclude results that only share part of the name. Prefer sources relevant to country code IN.',
    searchQueries: ['"Dr. Sudama Lalwani"', 'Dr. Sudama Lalwani'],
  })
  assert.deepEqual(
    buildExactEntityFallbackPlan(['broad query', '"Dr. Sudama Lalwani"']),
    {
      label: 'Dr. Sudama Lalwani',
      identityTerms: ['sudama', 'lalwani'],
      objective:
        'Identify the exact person or entity named "Dr. Sudama Lalwani" and return authoritative profile details. ' +
        'Exclude results that only share part of the name.',
      searchQueries: ['"Dr. Sudama Lalwani"', 'Dr. Sudama Lalwani'],
    },
  )
  assert.equal(buildExactEntityFallbackPlan('latest orthopedic surgery news'), null)
})

test('exact entity match requires every identity term', () => {
  const terms = ['sudama', 'lalwani']
  assert.equal(hasExactEntityMatch({
    results: [
      { title: 'Dr. Siddhant Lalwani', url: 'https://example.com/siddhant-lalwani' },
      { title: 'Doctors in Sudama Nagar', url: 'https://example.com/sudama-nagar' },
    ],
  }, terms), false)
  assert.equal(hasExactEntityMatch({
    results: [
      { title: 'Dr. Sudama Lalwani', url: 'https://example.com/dr-sudama-lalwani' },
    ],
  }, terms), true)
})

test('exact entity filtering drops partial-name and unrelated results', () => {
  const plan = buildExactEntityFallbackPlan('Who is Dr. Sudama Lalwani?')
  assert.ok(plan)
  assert.deepEqual(filterExactEntityResults({
    id: 'quick',
    results: [
      { title: 'Dr. Sudama Lalwani, Orthopedics Physician', url: 'https://example.com/dr-sudama-lalwani' },
      { title: 'Dr. Siddhant Lalwani', url: 'https://example.com/dr-siddhant-lalwani' },
      { title: 'Doctors in Sudama Nagar', url: 'https://example.com/sudama-nagar' },
    ],
  }, plan), {
    id: 'quick',
    results: [
      { title: 'Dr. Sudama Lalwani, Orthopedics Physician', url: 'https://example.com/dr-sudama-lalwani' },
    ],
    search_strategy: 'exact_entity_filter',
    search_note:
      'Results were limited to exact title or URL matches for "Dr. Sudama Lalwani". ' +
      'Treat the first detailed profile as the primary identity. Do not infer separate people solely from conflicting specialties in sparse directories unless distinct identifiers support that conclusion.',
  })
})

test('exact entity fallback replaces weak results with normalized exact matches', () => {
  const plan = buildExactEntityFallbackPlan('Dr. Sudama Lalwani')
  assert.ok(plan)
  const merged = mergeExactEntityFallbackResults({
    id: 'quick',
    results: [
      { title: 'Dr. Siddhant Lalwani', url: 'https://example.com/siddhant' },
      { title: 'Dr. Sudama Lalwani, Orthopedics Physician', url: 'https://example.com/dr-sudama-lalwani' },
    ],
  }, {
    search_id: 'deep',
    results: [
      {
        title: 'Dr. Sudama Lalwani - Specialist Orthopedic Surgeon',
        url: 'https://linkedin.com/in/dr-sudama-lalwani',
        excerpts: ['Orthopaedic Surgeon in Jaipur.', 'Oxford Medical Center, Abu Dhabi.'],
      },
      {
        title: 'Another Lalwani',
        url: 'https://example.com/another-lalwani',
        excerpts: ['This unrelated document mentions Dr. Sudama Lalwani in passing.'],
      },
    ],
  }, plan)

  assert.deepEqual(merged, {
    id: 'quick',
    results: [{
      title: 'Dr. Sudama Lalwani - Specialist Orthopedic Surgeon',
      url: 'https://linkedin.com/in/dr-sudama-lalwani',
      excerpts: ['Orthopaedic Surgeon in Jaipur.', 'Oxford Medical Center, Abu Dhabi.'],
      snippet: 'Orthopaedic Surgeon in Jaipur.\n\nOxford Medical Center, Abu Dhabi.',
    }, {
      title: 'Dr. Sudama Lalwani, Orthopedics Physician',
      url: 'https://example.com/dr-sudama-lalwani',
    }],
    search_strategy: 'exact_entity_deep_augmentation',
    search_note:
      'Exact matches for "Dr. Sudama Lalwani" were enriched with deeper exact-entity search results. ' +
      'Treat the first detailed profile as the primary identity. Do not infer separate people solely from conflicting specialties in sparse directories unless distinct identifiers support that conclusion.',
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
