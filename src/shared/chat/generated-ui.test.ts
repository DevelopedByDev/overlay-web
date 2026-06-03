import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERATED_UI_DATA_TYPE,
  buildGeneratedUiPart,
  generatedUiDataToPlainText,
  normalizeGeneratedUiData,
} from '@overlay/chat-core/generated-ui'
import {
  buildAssistantPersistenceFromSteps,
  compactAssistantPersistenceForConvex,
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
