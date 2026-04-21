import test from 'node:test'
import assert from 'node:assert/strict'

const {
  findSubstringMatchesInText,
  dedupeFileIdsPreserveOrder,
} = await import(new URL('./file-text-search.ts', import.meta.url).href)

test('findSubstringMatchesInText finds case-insensitive non-overlapping matches', () => {
  const fullText = 'Hello WORLD hello world'
  const { matches, truncated } = findSubstringMatchesInText({
    fullText,
    query: 'hello',
    contextChars: 4,
    maxMatches: 10,
    maxTotalSnippetChars: 10_000,
  })
  assert.equal(truncated, false)
  assert.equal(matches.length, 2)
  assert.equal(matches[0]!.charStart, 0)
  assert.equal(matches[1]!.charStart, 12)
})

test('findSubstringMatchesInText returns empty for blank query', () => {
  const { matches } = findSubstringMatchesInText({
    fullText: 'abc',
    query: '   ',
    contextChars: 10,
    maxMatches: 5,
    maxTotalSnippetChars: 1000,
  })
  assert.equal(matches.length, 0)
})

test('dedupeFileIdsPreserveOrder dedupes and preserves order', () => {
  assert.deepEqual(
    dedupeFileIdsPreserveOrder(['a', 'b', 'a', '', '  ', 'b', 'c']),
    ['a', 'b', 'c'],
  )
})

test('findSubstringMatchesInText respects maxMatches', () => {
  const fullText = 'foo foo foo foo foo'
  const { matches } = findSubstringMatchesInText({
    fullText,
    query: 'foo',
    contextChars: 0,
    maxMatches: 2,
    maxTotalSnippetChars: 10_000,
  })
  assert.equal(matches.length, 2)
})

test('Unicode: lowercase match in Cyrillic or basic BMP', () => {
  const { matches } = findSubstringMatchesInText({
    fullText: 'Умом Россию понять',
    query: 'россию',
    contextChars: 2,
    maxMatches: 5,
    maxTotalSnippetChars: 500,
  })
  assert.equal(matches.length, 1)
  assert.ok(matches[0]!.snippet.toLowerCase().includes('россию'))
})
