import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_OVERLAY_FEATURE_MODULES,
  DEFAULT_OVERLAY_NAVIGATION,
  DEFAULT_OVERLAY_SETTINGS_PANELS,
  resolveOverlayAppShellConfig,
} from './app-shell'

test('resolveOverlayAppShellConfig merges registry overrides by id', () => {
  const shell = resolveOverlayAppShellConfig({
    navigation: [
      { ...DEFAULT_OVERLAY_NAVIGATION[0]!, label: 'Assistant' },
      { id: 'admin', href: '/app/admin', label: 'Admin', icon: 'shield-check' },
    ],
    settingsPanels: [
      { ...DEFAULT_OVERLAY_SETTINGS_PANELS[0]!, label: 'Workspace general' },
      { id: 'security', sectionId: 'account', label: 'Security', componentKey: 'enterprise.security' },
    ],
    featureModules: [
      { ...DEFAULT_OVERLAY_FEATURE_MODULES[0]!, componentKey: 'enterprise.filesKnowledge' },
    ],
  })

  assert.equal(shell.navigation.find((item) => item.id === 'chat')?.label, 'Assistant')
  assert.equal(shell.navigation.find((item) => item.id === 'admin')?.href, '/app/admin')
  assert.equal(shell.settingsPanels.find((item) => item.id === 'general')?.label, 'Workspace general')
  assert.equal(shell.settingsPanels.find((item) => item.id === 'security')?.componentKey, 'enterprise.security')
  assert.equal(shell.featureModules.find((item) => item.id === 'files-knowledge')?.componentKey, 'enterprise.filesKnowledge')
})

test('resolveOverlayAppShellConfig filters disabled feature registries', () => {
  const shell = resolveOverlayAppShellConfig({
    featureFlags: [{ id: 'knowledge', label: 'Knowledge', enabled: false }],
  })

  assert.equal(shell.navigation.some((item) => item.featureFlagId === 'knowledge'), false)
  assert.equal(shell.settingsPanels.some((item) => item.featureFlagId === 'knowledge'), false)
  assert.equal(shell.featureModules.some((item) => item.featureFlagId === 'knowledge'), false)
})
