import { redirect } from 'next/navigation'

export default async function NotesPage() {
  redirect('/app/notes')
}
