# Design

Overlay should feel quiet, capable, and work-focused. Prefer dense but readable product UI over decorative marketing composition inside the app.

## Principles

- Keep primary workflows immediately usable on the first screen.
- Use progressive disclosure for advanced controls.
- Preserve existing app chrome and spacing before introducing new visual systems.
- Favor restrained surfaces, clear hierarchy, and predictable navigation.
- Avoid nested cards, oversized decorative sections, and one-note palettes.
- Validate important UI changes visually, especially theme, layout, and responsive changes.

## Theme System

Theme presets currently control:

- background, foreground, muted text, borders, and surface colors
- sidebar, glass, scrim, selection, and scrollbar colors
- UI and mono font stacks
- accent, skill, success, warning, and danger colors
- button, input, chat badge, alert, media error, and tool-row colors

Preset definitions live in `src/lib/themes.ts`. Runtime application happens in `src/components/app/AppSettingsProvider.tsx`.

## App Typography

- Default UI text should use `var(--font-sans)`.
- Code/editor text should use `var(--font-mono)`.
- Brand/editorial headings may use `var(--font-serif)`.
- Theme-specific fonts must always include the default app fallback stack so missing fonts do not fall back to browser serif defaults.

## Controls

Use familiar controls:

- icon buttons for common actions
- segmented controls for modes
- toggles for booleans
- sliders/inputs for numeric values
- menus/selects for option sets
- tabs for stable view switching
