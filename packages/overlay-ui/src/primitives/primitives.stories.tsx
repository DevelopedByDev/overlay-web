import type { Meta, StoryObj } from '@storybook/react'
import { Badge, Button, Card, Dialog, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Toggle } from '../index'
import * as React from 'react'

const meta: Meta = {
  title: 'Overlay UI/Primitives',
}

export default meta
type Story = StoryObj

function ControlsDemo() {
  const [open, setOpen] = React.useState(false)
  const [checked, setChecked] = React.useState(true)
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Badge>Admin</Badge>
      </div>
      <Input placeholder="Workspace name" />
      <Textarea placeholder="Instructions" />
      <Select value="prod" onChange={() => {}} options={[{ value: 'prod', label: 'Production' }, { value: 'dev', label: 'Development' }]} />
      <Toggle checked={checked} onChange={setChecked} />
      <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Instance settings">
        <p>Enterprise controls render inside the shared dialog primitive.</p>
      </Dialog>
    </div>
  )
}

export const Controls: Story = {
  render: () => <ControlsDemo />,
}

export const DataTable: Story = {
  render: () => (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>User</TableHeader>
            <TableHeader>Role</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>admin@example.edu</TableCell>
            <TableCell>superadmin</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  ),
}
