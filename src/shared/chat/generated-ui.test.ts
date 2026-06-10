import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERATED_UI_DATA_TYPE,
  buildGeneratedUiPart,
  generatedUiDataToPlainText,
  normalizeGeneratedUiData,
} from '@overlay/chat-core/generated-ui'
import { collectWebSourcesFromBlocks } from '@overlay/chat-core/sources'
import {
  buildAssistantPersistenceFromSteps,
  compactAssistantPersistenceForConvex,
  replaceAssistantTextForPersistence,
} from './persist-assistant-turn'

test('normalizeGeneratedUiData validates and trims text draft payloads', () => {
  const normalized = normalizeGeneratedUiData({
    version: 1,
    kind: 'draft.text',
    title: '  Essay draft  ',
    body: '  The Mughals shaped Indian history.  ',
    format: 'markdown',
  })

  assert.deepEqual(normalized, {
    version: 1,
    kind: 'draft.text',
    title: 'Essay draft',
    body: 'The Mughals shaped Indian history.',
    format: 'markdown',
  })
  assert.equal(normalizeGeneratedUiData({ version: 1, kind: 'draft.text', body: ' ' }), null)
})

test('generated UI email data is summarized as model-readable text', () => {
  const normalized = normalizeGeneratedUiData({
    version: 1,
    kind: 'draft.email',
    subject: 'AI workspace for your team',
    body: 'Overlay keeps AI work in one place.',
    to: ['cto@example.com'],
    provider: 'gmail',
  })

  assert.ok(normalized)
  assert.equal(
    generatedUiDataToPlainText(normalized),
    'To: cto@example.com\n\nSubject: AI workspace for your team\n\nOverlay keeps AI work in one place.',
  )
})

test('present_generated_ui tool results persist as generated UI data parts', () => {
  const persistence = buildAssistantPersistenceFromSteps(
    [
      {
        text: '',
        toolCalls: [
          {
            toolCallId: 'tool-1',
            toolName: 'present_generated_ui',
            input: {},
          },
        ],
        toolResults: [
          {
            toolCallId: 'tool-1',
            output: {
              success: true,
              id: 'ui-1',
              generatedUi: {
                version: 1,
                kind: 'draft.text',
                title: 'Essay',
                body: 'A concise essay body.',
              },
            },
          },
        ],
      },
    ] as never,
    '',
  )

  assert.equal(persistence.content, 'Essay\n\nA concise essay body.')
  assert.deepEqual(persistence.parts[0], {
    type: 'data',
    id: 'ui-1',
    dataType: GENERATED_UI_DATA_TYPE,
    data: {
      version: 1,
      kind: 'draft.text',
      title: 'Essay',
      body: 'A concise essay body.',
    },
  })
})

test('compactAssistantPersistenceForConvex preserves only valid generated UI parts', () => {
  const validPart = buildGeneratedUiPart('ui-2', {
    version: 1,
    kind: 'connector.connect',
    serviceName: 'Asana',
    description: 'Create tasks and manage projects.',
  })
  assert.ok(validPart)

  const compacted = compactAssistantPersistenceForConvex({
    content: 'Asana\nCreate tasks and manage projects.',
    parts: [
      validPart,
      {
        type: 'data',
        id: 'bad',
        dataType: GENERATED_UI_DATA_TYPE,
        data: { version: 1, kind: 'draft.text', body: '' },
      },
    ],
  })

  assert.equal(compacted.parts.length, 2)
  assert.deepEqual(compacted.parts[0], validPart)
  assert.deepEqual(compacted.parts[1], {
    type: 'text',
    text: '[1 additional assistant parts omitted for storage]',
  })
})

test('compactAssistantPersistenceForConvex preserves normalized web sources', () => {
  const compacted = compactAssistantPersistenceForConvex({
    content: 'Answer with sources.',
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'search-1',
          toolName: 'parallel_search',
          state: 'output-available',
          toolInput: { objective: 'Find reviews' },
          toolOutput: {
            results: [
              {
                url: 'https://example.com/review',
                title: 'Example review',
                snippet: 'A useful review.',
                rawContent: 'x'.repeat(10_000),
              },
              {
                url: 'https://second.example/article',
                title: 'Second article',
              },
            ],
          },
        },
      },
      { type: 'text', text: 'Answer with sources.' },
    ],
  })

  const invocation = compacted.parts[0]?.toolInvocation as
    | { toolOutput?: { sources?: unknown[]; summary?: string; truncated?: boolean } }
    | undefined
  assert.equal(invocation?.toolOutput?.truncated, true)
  assert.match(invocation?.toolOutput?.summary ?? '', /rawContent/)
  assert.deepEqual(invocation?.toolOutput?.sources, [
    {
      url: 'https://example.com/review',
      title: 'Example review',
      snippet: 'A useful review.',
      origin: 'web-search',
    },
    {
      url: 'https://second.example/article',
      title: 'Second article',
      origin: 'web-search',
    },
  ])
})

test('replaceAssistantTextForPersistence retains source-bearing tool parts', () => {
  const toolPart = {
    type: 'tool-invocation',
    toolInvocation: {
      toolCallId: 'search-1',
      toolName: 'perplexity_search',
      state: 'output-available',
      toolOutput: { sources: [{ url: 'https://example.com', title: 'Example' }] },
    },
  }
  const replaced = replaceAssistantTextForPersistence({
    content: 'Leaked tool syntax',
    parts: [
      toolPart,
      { type: 'text', text: 'Leaked tool syntax' },
    ],
  }, 'Clean answer')

  assert.equal(replaced.content, 'Clean answer')
  assert.deepEqual(replaced.parts, [
    toolPart,
    { type: 'text', text: 'Clean answer' },
  ])
})

test('legacy compacted tool summaries still recover source URLs', () => {
  const sources = collectWebSourcesFromBlocks([
    {
      kind: 'tool',
      key: 'legacy-search',
      name: 'parallel_search',
      state: 'output-available',
      toolOutput: {
        truncated: true,
        summary: '{"url":"https://example.com/review","title":"Example review"}',
      },
    },
  ])

  assert.deepEqual(sources, [{
    url: 'https://example.com/review',
    title: 'example.com',
    origin: 'web-search',
  }])
})
