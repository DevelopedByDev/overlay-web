'use client'

/**
 * Per-project visual identity. Renders a circular initial-letter badge with a
 * stable color hashed from the project id, so the same project always shows
 * the same color across views (sidebar, hub header, breadcrumbs, etc.).
 *
 * Logo upload support (replace the letter with an uploaded image) is planned
 * as a follow-up; the prop surface will extend with a `logoUrl` then. For now
 * the letter is the only render path.
 */

const AVATAR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
] as const

function hashToColor(input: string): string {
  let h = 0
  for (let index = 0; index < input.length; index += 1) {
    h = ((h << 5) - h + input.charCodeAt(index)) | 0
  }
  const palette = AVATAR_COLORS
  return palette[Math.abs(h) % palette.length] ?? palette[0]!
}

function firstLetter(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // Codepoint-safe (handles emoji + non-BMP chars).
  const first = Array.from(trimmed)[0] ?? '?'
  return first.toLocaleUpperCase()
}

export interface ProjectAvatarProps {
  /** Stable identifier used to derive the background color. */
  projectId: string
  /** Display name; first letter is rendered as the badge label. */
  name: string
  /** Square pixel size of the avatar (default 16). */
  size?: number
  /** Override for label color (default white). */
  textColor?: string
  /** Additional class on the wrapper. */
  className?: string
}

export function ProjectAvatar({
  projectId,
  name,
  size = 16,
  textColor = '#ffffff',
  className,
}: ProjectAvatarProps) {
  const letter = firstLetter(name)
  const background = hashToColor(projectId)
  // Font size scales with the badge but never below 8px so the letter stays
  // legible at the smallest sidebar sizes.
  const fontSize = Math.max(8, Math.round(size * 0.58))
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none${
        className ? ` ${className}` : ''
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: background,
        color: textColor,
        fontSize,
      }}
    >
      {letter}
    </span>
  )
}
