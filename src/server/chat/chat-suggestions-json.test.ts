import test from 'node:test'
import assert from 'node:assert/strict'

const { parseChatSuggestionsJson } = await import(
  new URL('./chat-suggestions-json.ts', import.meta.url).href
)

test('parseChatSuggestionsJson returns null for empty output', () => {
  assert.equal(parseChatSuggestionsJson(''), null)
})

test('parseChatSuggestionsJson returns null for truncated JSON', () => {
  assert.equal(parseChatSuggestionsJson('{"prompts": ['), null)
})

test('parseChatSuggestionsJson accepts fenced JSON', () => {
  assert.deepEqual(parseChatSuggestionsJson('```json\n{"prompts":["a","b"]}\n```'), {
    prompts: ['a', 'b'],
  })
})

test('parseChatSuggestionsJson extracts JSON object from surrounding text', () => {
  assert.deepEqual(parseChatSuggestionsJson('Here you go:\n{"prompts":["a"]}\nDone.'), {
    prompts: ['a'],
  })
})

test('parseChatSuggestionsJson rejects non-object JSON roots', () => {
  assert.equal(parseChatSuggestionsJson('["a", "b"]'), null)
})
