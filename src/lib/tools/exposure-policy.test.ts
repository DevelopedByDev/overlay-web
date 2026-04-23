import test from 'node:test'
import assert from 'node:assert/strict'

test('exposure policy keeps browser tool disabled on extension client unless the user requests browser work in text', async () => {
  const { allowedOverlayToolIdsForTurn } = await import(
    new URL('./exposure-policy.ts', import.meta.url).href,
  )
  const researchTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Find me academic papers about strength training',
  })
  assert.equal(researchTools.includes('interactive_browser_session'), false)

  const browserTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Log into the website and take a screenshot of the billing page',
  })
  assert.equal(browserTools.includes('interactive_browser_session'), true)

  const extensionSurface = allowedOverlayToolIdsForTurn({
    latestUserText: 'Fill out the form on this page and submit it',
    clientSurface: 'chrome-extension',
  })
  assert.equal(extensionSurface.includes('interactive_browser_session'), false)
})

test('exposure policy exposes high-risk tools only for explicit matching requests', async () => {
  const { allowedOverlayToolIdsForTurn } = await import(
    new URL('./exposure-policy.ts', import.meta.url).href,
  )
  const defaultTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Summarize my saved notes about pricing',
  })
  assert.equal(defaultTools.includes('run_daytona_sandbox'), false)
  assert.equal(defaultTools.includes('generate_image'), false)
  assert.equal(defaultTools.includes('create_note'), false)

  const daytonaTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Run a Python script in the sandbox to convert these files into a PowerPoint',
  })
  assert.equal(daytonaTools.includes('run_daytona_sandbox'), true)

  const noteTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Create a note with this summary and save it to my notes',
  })
  assert.equal(noteTools.includes('create_note'), true)

  const imageTools = allowedOverlayToolIdsForTurn({
    latestUserText: 'Generate an image poster for the launch event',
  })
  assert.equal(imageTools.includes('generate_image'), true)
})
