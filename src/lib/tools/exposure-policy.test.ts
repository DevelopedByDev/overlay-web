import test from 'node:test'
import assert from 'node:assert/strict'

test('ask mode keeps browser tool disabled unless the user explicitly requests UI/browser work', async () => {
  const { allowedOverlayToolIdsForTurn } = await import(
    new URL('./exposure-policy.ts', import.meta.url).href,
  )
  const researchTools = allowedOverlayToolIdsForTurn({
    mode: 'ask',
    latestUserText: 'Find me academic papers about strength training',
  })
  assert.equal(researchTools.includes('interactive_browser_session'), false)

  const browserTools = allowedOverlayToolIdsForTurn({
    mode: 'ask',
    latestUserText: 'Log into the website and take a screenshot of the billing page',
  })
  assert.equal(browserTools.includes('interactive_browser_session'), true)
})

test('act mode exposes high-risk tools only for explicit matching requests', async () => {
  const { allowedOverlayToolIdsForTurn } = await import(
    new URL('./exposure-policy.ts', import.meta.url).href,
  )
  const defaultTools = allowedOverlayToolIdsForTurn({
    mode: 'act',
    latestUserText: 'Summarize my saved notes about pricing',
  })
  assert.equal(defaultTools.includes('run_daytona_sandbox'), false)
  assert.equal(defaultTools.includes('generate_image'), false)
  assert.equal(defaultTools.includes('create_note'), false)

  const daytonaTools = allowedOverlayToolIdsForTurn({
    mode: 'act',
    latestUserText: 'Run a Python script in the sandbox to convert these files into a PowerPoint',
  })
  assert.equal(daytonaTools.includes('run_daytona_sandbox'), true)

  const noteTools = allowedOverlayToolIdsForTurn({
    mode: 'act',
    latestUserText: 'Create a note with this summary and save it to my notes',
  })
  assert.equal(noteTools.includes('create_note'), true)

  const imageTools = allowedOverlayToolIdsForTurn({
    mode: 'act',
    latestUserText: 'Generate an image poster for the launch event',
  })
  assert.equal(imageTools.includes('generate_image'), true)
})
