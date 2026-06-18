/**
 * Shared styling for marketing / auth / account surfaces.
 *
 * These surfaces render inside `LandingThemeProvider`, which sets a scoped
 * `data-theme` so the app's CSS-variable design tokens (see globals.css) resolve
 * correctly for light and dark. As a result these helpers emit token-based
 * classes and no longer need to know the active theme.
 */

export function marketingAuthCard(): string {
  return "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 shadow-sm";
}

export function marketingAuthMuted(): string {
  return "text-[var(--muted)]";
}

export function marketingSsoButton(): string {
  return [
    "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 border",
    "bg-[var(--button-secondary-bg)] border-[var(--button-secondary-border)] text-[var(--button-secondary-text)] hover:bg-[var(--surface-muted)]",
  ].join(" ");
}

export function marketingPrimaryField(): string {
  return [
    "w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 border",
    "bg-[var(--input-background)] border-[var(--input-border)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:ring-[var(--accent)]",
  ].join(" ");
}

export function marketingSubmitButton(): string {
  return [
    "w-full py-3 px-4 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50",
    "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:opacity-90",
  ].join(" ");
}

export function marketingDividerLabel(): string {
  return "px-4 bg-[var(--surface-elevated)] text-[var(--muted)]";
}

/** Account / pricing cards. */
export function marketingPanel(): string {
  return "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-sm";
}

export function marketingPanelLg(): string {
  return "mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 shadow-sm";
}

/** Typography for marketing surfaces. */
export function marketingPageTitle(): string {
  return "text-[var(--foreground)]";
}

export function marketingHeading(): string {
  return "text-[var(--foreground)]";
}

export function marketingBody(): string {
  return "text-[var(--muted)]";
}

export function marketingMuted(): string {
  return "text-[var(--muted-light)]";
}

export function marketingFeatureText(included: boolean): string {
  return included ? "text-[var(--foreground)]" : "text-[var(--muted-light)]";
}

// ---------------------------------------------------------------------------
// Shared layout + typography helpers for marketing pages.
//
// These consolidate the section/container/grid/eyebrow/heading strings that
// were previously inlined (and drifted) across home, for-business, and pricing.
// All token-based — they resolve correctly under LandingThemeProvider.
// ---------------------------------------------------------------------------

/** Full-width marketing section with top hairline + vertical rhythm. */
export function marketingSection(): string {
  return "border-t border-[var(--border)] px-5 py-16 md:px-8 md:py-24";
}

/** Centered max-width container used inside every marketing section. */
export function marketingContainer(): string {
  return "mx-auto max-w-7xl";
}

/**
 * Two-column hero grid (text left, visual right). One ratio across all pages
 * instead of the previous per-page splits (0.62/1.38, 0.72/1.28, etc.).
 */
export function marketingHeroGrid(): string {
  return "mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.6fr_1.4fr] lg:items-center";
}

/** Uppercase eyebrow label above section headings. */
export function marketingEyebrow(): string {
  return "text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted-light)]";
}

/**
 * Large display heading (section H2). Uses the serif display face
 * (Libre Baskerville via `--font-serif`) to match the navbar brand + demo title.
 */
export function marketingHeadingLg(): string {
  return "text-3xl tracking-tight md:text-5xl";
}

/** Inline style object to apply the serif display face to a heading element. */
export function marketingSerifStyle(): { fontFamily: string } {
  return { fontFamily: "var(--font-serif)" };
}

/**
 * Small icon chip used in feature/workflow lists. Matches the app's
 * `rounded-md` control styling (not `rounded-lg`).
 */
export function marketingIconChip(): string {
  return "flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)]";
}

/** Small feature card in a primitives grid. */
export function marketingFeatureCard(): string {
  return "bg-[var(--surface-elevated)] p-5";
}
