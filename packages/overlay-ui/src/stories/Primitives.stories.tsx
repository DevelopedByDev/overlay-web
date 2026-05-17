import {
  Badge,
  Button,
  EmptyState,
  FileTreeSkeleton,
  IconButton,
  Input,
  Select,
  TabsList,
  TabButton,
  Textarea,
  Toggle,
  Toolbar,
} from '../index'

const meta = {
  title: 'Overlay UI/Primitives',
}

export default meta

export function Controls() {
  return (
    <div className="flex max-w-2xl flex-col gap-5 bg-[var(--background)] p-6 text-[var(--foreground)]">
      <Toolbar className="rounded-xl border">
        <span className="text-sm font-medium">Toolbar</span>
        <Button className="ml-auto" size="sm" variant="primary">Primary</Button>
        <Button size="sm">Secondary</Button>
      </Toolbar>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <IconButton aria-label="Icon action">+</IconButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Input" />
        <Select defaultValue="one">
          <option value="one">Option one</option>
          <option value="two">Option two</option>
        </Select>
        <Textarea placeholder="Textarea" className="sm:col-span-2" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Toggle checked onCheckedChange={() => {}} aria-label="Enabled" />
        <Badge>Default</Badge>
        <Badge variant="muted">Muted</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </div>

      <TabsList>
        <TabButton active>Active</TabButton>
        <TabButton>Inactive</TabButton>
      </TabsList>

      <EmptyState
        title="No items"
        description="Reusable empty states use app tokens and compact spacing."
        action={<Button size="sm">Create item</Button>}
      />
    </div>
  )
}

export function Skeletons() {
  return (
    <div className="max-w-xl bg-[var(--background)] p-6">
      <FileTreeSkeleton rows={6} />
    </div>
  )
}
