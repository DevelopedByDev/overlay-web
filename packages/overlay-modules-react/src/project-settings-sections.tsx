'use client'

import { Github } from 'lucide-react'
import type { ProjectSettingsSection } from './project-settings-drawer'
import { GithubRepoAllowlistPicker, type GithubRepoAllowlistPickerProps } from './github-repo-picker'

export interface ProjectSettingsSectionContext {
  githubRepoPickerProps: GithubRepoAllowlistPickerProps
}

// Add new sections by appending one entry to this array.
export function createProjectSettingsSections(
  ctx: ProjectSettingsSectionContext,
): ProjectSettingsSection[] {
  return [
    {
      id: 'github-repositories',
      label: 'GitHub repositories',
      icon: <Github size={14} />,
      render: () => <GithubRepoAllowlistPicker {...ctx.githubRepoPickerProps} />,
    },
  ]
}
