import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_OVERLAY_FEATURE_MODULES,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_SETTINGS_PANELS,
  DEFAULT_OVERLAY_SIDEBAR_ACTIONS,
  resolveOverlayAppShellConfig,
  resolveFeatureModuleForPath,
  resolveSidebarActionForPath,
} from './app-shell'

test('resolveOverlayAppShellConfig uses provided navigation as the visible navigation list', () => {
  const shell = resolveOverlayAppShellConfig({
    navigation: [
      DEFAULT_OVERLAY_NAVIGATION.find((item) => item.id === 'projects')!,
    ],
  })

  assert.deepEqual(shell.navigation.map((item) => item.id), ['projects'])
})

test('resolveOverlayAppShellConfig merges non-navigation registry overrides by id', () => {
  const shell = resolveOverlayAppShellConfig({
    settingsPanels: [
      { ...DEFAULT_OVERLAY_SETTINGS_PANELS[0]!, label: 'Workspace general' },
      { id: 'security', sectionId: 'account', label: 'Security', componentKey: 'enterprise.security' },
    ],
    featureModules: [
      { ...DEFAULT_OVERLAY_FEATURE_MODULES[0]!, componentKey: 'enterprise.filesKnowledge' },
    ],
    sidebarActions: [
      { ...DEFAULT_OVERLAY_SIDEBAR_ACTIONS[0]!, label: 'Start chat' },
      { id: 'admin.invite', label: 'Invite user', actionKey: 'admin.invite', routePatterns: ['/app/admin'] },
    ],
  })

  assert.equal(shell.settingsPanels.find((item) => item.id === 'general')?.label, 'Workspace general')
  assert.equal(shell.settingsPanels.find((item) => item.id === 'security')?.componentKey, 'enterprise.security')
  assert.equal(shell.featureModules.find((item) => item.id === 'files-knowledge')?.componentKey, 'enterprise.filesKnowledge')
  assert.equal(shell.sidebarActions.find((item) => item.id === 'chat.create')?.label, 'Start chat')
  assert.equal(shell.sidebarActions.find((item) => item.id === 'admin.invite')?.routePatterns[0], '/app/admin')
})

test('resolveOverlayAppShellConfig filters disabled feature registries', () => {
  const shell = resolveOverlayAppShellConfig({
    featureFlags: [{ id: 'knowledge', label: 'Knowledge', enabled: false }],
  })

  assert.equal(shell.navigation.some((item) => item.featureFlagId === 'knowledge'), false)
  assert.equal(shell.settingsPanels.some((item) => item.featureFlagId === 'knowledge'), false)
  assert.equal(shell.featureModules.some((item) => item.featureFlagId === 'knowledge'), false)
  assert.equal(shell.sidebarActions.some((item) => item.featureFlagId === 'knowledge'), false)
})

test('sidebar registries resolve feature modules and actions from routes', () => {
  const shell = resolveOverlayAppShellConfig()

  assert.equal(resolveFeatureModuleForPath('/app/projects/child', shell.featureModules)?.id, 'projects')
  assert.equal(resolveSidebarActionForPath('/app/notes', shell.sidebarActions)?.actionKey, 'notes.create')
  assert.equal(resolveSidebarActionForPath('/app/settings', shell.sidebarActions), null)
})
