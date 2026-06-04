import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defineOverlayExtension,
  defineOverlayExtensions,
  extendOverlayAppConfig,
  extensionPathSegments,
  findOverlayExtensionApiHandler,
  normalizeExtensionPath,
} from './index'

test('defineOverlayExtension validates id and preserves extension literals', () => {
  const extension = defineOverlayExtension({
    id: 'student-revision',
    version: '1.0.0',
    navigation: [{ id: 'student-revision', label: 'Student Revision', href: '/app/x/student-revision', icon: 'sparkles' }],
  })

  assert.equal(extension.id, 'student-revision')
  assert.throws(() => defineOverlayExtension({ id: 'Student Revision', version: '1.0.0' }))
  assert.throws(() => defineOverlayExtension({ id: 'student-revision', version: '' }))
})

test('defineOverlayExtensions rejects duplicate extension ids', () => {
  assert.throws(() => defineOverlayExtensions([
    { id: 'student-revision', version: '1.0.0' },
    { id: 'student-revision', version: '1.0.1' },
  ]))
})

test('extendOverlayAppConfig appends extension registries without dropping base config', () => {
  const extended = extendOverlayAppConfig({
    brand: { name: 'Overlay', logoSrc: '/logo.png', homeHref: '/app/chat' },
    navigation: [{ id: 'chat', label: 'Chat', href: '/app/chat', icon: 'message-square' }],
  }, [
    {
      id: 'student-revision',
      version: '1.0.0',
      navigation: [{ id: 'student-revision', label: 'Student Revision', href: '/app/x/student-revision', icon: 'sparkles' }],
      featureModules: [{
        id: 'student-revision',
        label: 'Student Revision',
        routePatterns: ['/app/x/student-revision'],
        componentKey: 'student.modules.revision',
      }],
      settingsSections: [{ id: 'student-revision', label: 'Student Revision' }],
      settingsPanels: [{
        id: 'student-revision-policy',
        sectionId: 'student-revision',
        label: 'Student Revision Policy',
        componentKey: 'student.settings.revisionPolicy',
      }],
      tools: [{ id: 'revision-plan', label: 'Revision Plan' }],
    },
  ])

  assert.equal(extended.brand?.name, 'Overlay')
  assert.deepEqual(extended.navigation?.map((item) => item.id), ['chat', 'student-revision'])
  assert.equal(extended.featureModules?.[0]?.componentKey, 'student.modules.revision')
  assert.equal(extended.settingsSections?.[0]?.id, 'student-revision')
  assert.equal(extended.settingsPanels?.[0]?.componentKey, 'student.settings.revisionPolicy')
  assert.equal(extended.tools?.[0]?.id, 'revision-plan')
})

test('extension API handler lookup normalizes methods and paths', () => {
  const handler = () => Response.json({ ok: true })
  const extension = defineOverlayExtension({
    id: 'student-revision',
    version: '1.0.0',
    apiHandlers: [{ method: 'GET', path: '/plans', handler }],
  })

  assert.equal(findOverlayExtensionApiHandler([extension], {
    extensionId: 'student-revision',
    method: 'get',
    path: 'plans/',
  })?.handler, handler)
  assert.equal(findOverlayExtensionApiHandler([extension], {
    extensionId: 'student-revision',
    method: 'POST',
    path: '/plans',
  }), null)
  assert.equal(findOverlayExtensionApiHandler([extension], {
    extensionId: 'unknown',
    method: 'GET',
    path: '/plans',
  }), null)
})

test('extension path helpers normalize route segments', () => {
  assert.equal(normalizeExtensionPath(['plans', 'today']), '/plans/today')
  assert.equal(normalizeExtensionPath('//plans///today/'), '/plans/today')
  assert.deepEqual(extensionPathSegments('/plans/today'), ['plans', 'today'])
})
