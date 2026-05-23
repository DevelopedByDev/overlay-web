import { redirect } from 'next/navigation'

// Project-first landing: /app → /app/projects. Chat is no longer a global
// top-level surface; it lives inside a project. The /app/chat route still
// exists (deep links from email / search engines / bookmarks still work)
// but it's not the default destination anymore.
export default function AppPage() {
  redirect('/app/projects')
}
