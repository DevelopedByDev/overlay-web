import type { Meta, StoryObj } from '@storybook/react'
import { PageShell, ScrollContainer, SplitPane } from '../index'

const meta: Meta = {
  title: 'Overlay UI/Layout',
}

export default meta
type Story = StoryObj

export const Shells: Story = {
  render: () => (
    <PageShell header={<strong>Admin</strong>} style={{ height: 420 }}>
      <SplitPane
        left={<ScrollContainer style={{ padding: 16 }}>Health checks, users, and roles</ScrollContainer>}
        right={<ScrollContainer style={{ padding: 16 }}>Audit log and settings</ScrollContainer>}
      />
    </PageShell>
  ),
}
