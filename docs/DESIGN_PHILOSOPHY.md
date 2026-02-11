# Dawn Design Philosophy

> **Core Principle**: *Move execution to where intent first appears, using overlays.*

This document captures the complete design language of Dawn's landing page to ensure consistent application across all UI surfaces.

---

## 1. Design Philosophy

### The "Overlay-First" Aesthetic

Dawn's design is built on the philosophy of **intentional minimalism with purposeful depth**. The interface should feel:

- **Effortless**: Every interaction feels inevitable, like it was always meant to work this way
- **Floating**: Elements exist in layered space, with the liquid glass background creating ambient depth
- **Focused**: No chrome, no distractions—only the task at hand
- **Human**: Serif typography brings warmth to technical precision

### Key Principles

| Principle | Application |
|-----------|-------------|
| **Progressive Disclosure** | Information reveals itself through scroll, not clutter |
| **Non-Disruptive** | Overlays appear without breaking visual or cognitive flow |
| **Ambient Depth** | Background elements provide depth without distraction |
| **Tactile Digital** | Physical button metaphors (pills, waves) in clean digital space |

---

## 2. Color Palette

### Primary Colors

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `--background` | `#fafafa` | Page background, off-white warmth |
| `--foreground` | `#0a0a0a` | Primary text, near-black |
| `--muted` | `#71717a` | Secondary text, subtle elements |
| `--muted-light` | `#a1a1aa` | Tertiary text, hints |
| `--border` | `#e4e4e7` | Subtle borders, dividers |

### Dark UI Colors (for Overlays/Demos)

| Element | Hex Value | Usage |
|---------|-----------|-------|
| iMessage Background | `#1c1c1e` | Dark container backgrounds |
| Bubble Received | `#3a3a3c` | Secondary containers |
| Accent Blue | `#007aff` | Interactive elements, send buttons |
| Dark Text | `#8e8e93` | Placeholder text in dark UI |

### Glassmorphism Colors

| Element | Value | Usage |
|---------|-------|-------|
| Glass Background | `rgba(255, 255, 255, 0.7)` | Translucent surfaces |
| Glass Border | `rgba(255, 255, 255, 0.5)` | Frosted edges |
| Dark Glass BG | `rgba(19, 19, 19, 0.8)` | Control pill background |
| Dark Glass Border | `rgba(255, 255, 255, 0.3)` | Control pill border |
| Active Button BG | `rgba(255, 255, 255, 0.25)` | Selected state |
| Inactive Button BG | `rgba(255, 255, 255, 0.08)` | Default button state |

### Semantic Text Colors

- **Primary headings**: `#0a0a0a`
- **Taglines/descriptions**: `#71717a`
- **Hints/footnotes**: `#a1a1aa`
- **Inverted (on dark)**: `white` / `rgba(255,255,255,0.7)`

---

## 3. Typography

### Font Stack

```css
/* Serif (Headings) */
--font-serif: var(--font-instrument-serif), Georgia, 'Times New Roman', serif;

/* Sans-serif (Body/UI) */
--font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Primary Font: Instrument Serif

- **Weight**: 400 (regular only)
- **Style**: Elegant, editorial, human
- **Usage**: All headings, display text, brand voice
- **Source**: Google Fonts via Next.js `next/font/google`

### Type Scale

| Element | Font | Size | Letter Spacing | Line Height |
|---------|------|------|----------------|-------------|
| Hero Title | Serif | `6xl/8xl` (60px/96px) | `tracking-tight` | Normal |
| Section Heading | Serif | `5xl-7xl` (48px-72px) | Tight | `leading-tight` |
| Philosophy Text | Serif | `4xl-6xl` (36px-60px) | Tight | `leading-tight` |
| Tagline | Sans | `lg-xl` (18px-20px) | `tracking-wide` | Normal |
| Body/Labels | Sans | `sm` (14px) | Normal | Relaxed |
| Annotation | Sans | `sm` (14px) | Normal | `leading-relaxed` |
| Instruction | Sans | `sm` (14px) | Normal | Normal |
| Kbd/Shortcuts | Mono | `11px` | Normal | Normal |

### Typography Patterns

**Headings**
```
font-serif text-5xl md:text-6xl lg:text-7xl mb-4
```

**Taglines**
```
text-lg md:text-xl text-[#71717a] font-light tracking-wide
```

**Philosophy Statements**
```
font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a]
```

**Instruction Text**
```
text-sm text-[#71717a]
```

### Text Hierarchy

1. **Primary statements** (dark): Core philosophy, feature names
2. **Secondary connectors** (muted gray): + symbols, joining words
3. **Accent concepts** (muted gray): "intent", "overlays", "overlay-first computing"
4. **Annotations** (dark 70%): Explanatory side notes

---

## 4. Layout & Spacing

### Section Architecture

The landing page uses a **scroll-driven pinned section** architecture:

- 11 total sections, each occupying full viewport
- Total scroll height: `1100vh`
- Sections transition via opacity/transform, not page loads

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| Section padding | `px-6` | Horizontal safe zones |
| Component gaps | `gap-12` (48px) | Between major elements |
| Tight gaps | `gap-4` (16px) | Between related elements |
| Vertical rhythm | `mb-4`, `mb-8` | Element spacing |
| Content max-width | `max-w-3xl`, `max-w-5xl` | Reading comfort |

### Z-Index Stack

| Layer | Z-Index | Content |
|-------|---------|---------|
| Background | 0 | Liquid glass effect |
| Fixed sections | 10 | Hero, philosophy, features |
| Overlays | 10 | Demo overlays |
| Control pill | 30 | Bean control panel |
| Interactive | Auto | Buttons, links |

---

## 5. Components & UI Patterns

### The "Pill" - Primary Interactive Element

**Button Style** (Download/CTA)
```
bg-[#0a0a0a] text-white rounded-full
px-6 py-3 (small) / px-8 py-4 (large)
text-sm font-medium
hover:bg-[#27272a] transition-all duration-300
inline-flex items-center gap-3
```

**Control Pill** (Bean/Control Panel)
```
width: 48px → 200px (expanded)
height: 10px → 48px (expanded)
border-radius: 12px → 28px (expanded)
background: rgba(19, 19, 19, 0.8) → 0.95 (hover)
border: 1px solid rgba(255, 255, 255, 0.3) → 0.15 (expanded)
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1)
```

### Glassmorphism Cards

**Standard Glass**
```css
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.5);
```

**Dark Glass**
```css
background: rgba(0, 0, 0, 0.03);
backdrop-filter: blur(20px);
border: 1px solid rgba(0, 0, 0, 0.05);
```

### Overlay Windows

- **Border radius**: `rounded-2xl` (16px) for containers, `rounded-xl` (12px) for inner
- **Shadow**: Implicit via glassmorphism, no explicit shadow
- **Positioning**: Absolute, breaking out of containers
- **Overflow**: `overflow-hidden` on containers, `overflow-visible` when overlays extend

### Keyboard Shortcuts (KBD)

```
bg-[#e4e4e7] rounded
px-1.5 py-0.5
text-[11px] font-mono
mx-0.5
```

### Icons

- **Size**: 18x18px (control buttons), 24x24px (inline)
- **Stroke width**: 1.75px
- **Style**: Outline/lucide-style, consistent stroke
- **Color**: Inherits from parent (white on dark, muted on light)

### Waveform Visualization

```
bar_count: 7 (small) / 13 (large)
bar_width: 2.5-3px
max_height: 14-15px
gap: 1.5-2px
animation: Real-time audio levels with 0.15s transitions
```

---

## 6. Animation & Motion

### Animation Philosophy

- **Purposeful**: Every animation guides attention or provides feedback
- **Smooth**: Consistent `cubic-bezier(0.4, 0, 0.2, 1)` easing (ease-out)
- **Quick but Perceived**: 0.2-0.3s duration for UI, longer for scroll reveals
- **Physically Grounded**: Springs, bounces, and inertia where appropriate

### Scroll-Driven Animations

Using Framer Motion `useScroll` and `useTransform`:

```typescript
// Section opacity pattern
const sectionOpacity = useTransform(
  scrollYProgress, 
  [0.20, 0.22, 0.28, 0.30], 
  [0, 1, 1, 0]
);

// Entrance: quick fade in
// Settle: hold at full opacity
// Exit: graceful fade out
```

### Standard Transitions

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| Opacity fade | 0.25s | `[0.4, 0, 0.2, 1]` | Overlay appear/disappear |
| Scale spring | 0.3s | `[0.4, 0, 0.2, 1]` | Button press, modal open |
| Height expand | 0.25s | `[0.4, 0, 0.2, 1]` | Pill expansion |
| Position slide | 0.3s | `[0.4, 0, 0.2, 1]` | Overlay entrance |
| Waveform | 0.15s | `ease` | Audio level updates |

### Liquid Glass Background Animation

```css
animation: liquid-move 20s ease-in-out infinite;
/* Multi-layered radial gradients that slowly drift */
/* Creates ambient, living depth */
```

### Micro-interactions

- **Button hover**: `hover:scale-110` on icon buttons
- **Link hover**: `hover:text-[#0a0a0a]` transition-colors
- **Focus states**: Via cursor, no visible rings (minimal aesthetic)

---

## 7. Assets & Media

### Logo

- **File**: `dawn-logo.png`
- **Resolution**: 512x512px (displayed at 180x180px hero, 24x24px footer)
- **Style**: Gradient sunrise/sunset gradient
- **Shadow**: `drop-shadow-2xl` on hero placement

### Screen Images

**Base Screens** (`/assets/window-screens/`)
- `note-screen.png` - Browser/document context for notes
- `chat-screen.png` - Slack/discord-like context for chat
- `browser-screen.png` - Arc browser context for browser overlay

**Overlay Images** (`/assets/overlays/`)
- `note-overlay.png` - Notes input interface
- `chat-overlay.png` - AI chat interface
- `browser-overlay.png` - Quick search interface
- `transcription-overlay.png` - Voice transcription result

### Image Specifications

- **Format**: PNG with transparency where appropriate
- **Border radius**: Images have baked-in 16px border radius
- **Shadow**: Subtle drop shadow included in image asset
- **Context**: Screens show realistic app contexts (Arc, Slack, etc.)

---

## 8. Interaction Patterns

### Scroll-Triggered Behaviors

| Section | Trigger Point | Action |
|---------|---------------|--------|
| Philosophy | 10-14% | "using overlays" fades in, main text fades out |
| Voice | 40% | Overlay auto-opens |
| Notes/Chat/Browser | 40% | Overlay appears, 70% annotation appears |
| All In One Place | 15-60% | Sequential overlay reveal (clockwise) |

### User-Initiated Actions

**Keyboard Shortcuts**
- `⌥ + Space` - Voice recording (demo)
- `⌘ + /` - Notes overlay
- `⌘ + .` - Chat overlay  
- `⌘ + \` - Browser overlay

**Click/Tap**
- Primary CTA buttons: Full rounded pill
- Secondary actions: Underlined text links
- Control buttons: Circular 32x32px icons

### Hover States

| Element | Idle | Hover | Active |
|---------|------|-------|--------|
| Download button | bg-[#0a0a0a] | bg-[#27272a] | Same |
| Text links | text-[#71717a] | text-[#0a0a0a] | Same |
| Control pill | 48x10px | 200x48px + buttons | Same |
| Icon buttons | 70% opacity | 100% + scale(1.1) | Selected state |

---

## 9. Responsive Behavior

### Breakpoints

- **Mobile**: Default styles
- **Tablet**: `md:` (768px+)
- **Desktop**: `lg:` (1024px+)

### Responsive Patterns

| Element | Mobile | Desktop |
|---------|--------|---------|
| Hero title | `text-6xl` | `text-8xl` |
| Section headings | `text-5xl` | `text-7xl` |
| Philosophy text | `text-4xl` | `text-6xl` |
| Overlay positioning | Centered | Offset (left/right edges) |
| Footer | Stacked column | Horizontal row |

### Mobile Considerations

- Touch targets: Minimum 44x44px
- No hover-dependent interactions
- Simplified animations (reduced motion respect)
- Single-column layouts

---

## 10. Implementation Guidelines

### Tailwind Configuration

```typescript
// tailwind.config.ts additions
{
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        background: '#fafafa',
        foreground: '#0a0a0a',
        muted: '#71717a',
        'muted-light': '#a1a1aa',
        border: '#e4e4e7',
      },
    },
  },
}
```

### CSS Variables (globals.css)

```css
:root {
  --background: #fafafa;
  --foreground: #0a0a0a;
  --muted: #71717a;
  --muted-light: #a1a1aa;
  --border: #e4e4e7;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.5);
}
```

### Framer Motion Patterns

```typescript
// Standard section animation
<motion.section 
  style={{ opacity: sectionOpacity }}
  className="fixed inset-0 z-10"
>

// Overlay entrance
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 10 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 10 }}
  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
>
```

---

## 11. Brand Voice

### Tone

- **Clear**: No jargon, simple statements
- **Confident**: Declarative, not tentative
- **Human**: "speak your mind", "capture that thought"
- **Philosophical**: "move execution to where intent first appears"

### Naming Conventions

- Lowercase product name: `dawn`
- Feature names: `voice`, `notes`, `chat`, `browser`
- Concept terms: `overlays`, `flow`, `overlay-first computing`
- Actions: `begin`, `respond`, `capture`

### Key Phrases

- "personal computing, reimagined"
- "without breaking flow"
- "welcome to overlay-first computing"
- "the computer, at the speed of human thought"

---

## Summary

Dawn's design is a masterclass in **restrained sophistication**. The aesthetic achieves sophistication not through complexity, but through the considered application of:

1. **A warm off-white canvas** (`#fafafa`)
2. **Editorial serif typography** (Instrument Serif)
3. **Purposeful negative space**
4. **Liquid glass depth**
5. **Smooth, meaningful motion**
6. **Overlay-centric interactions**

When extending this design to the application itself, preserve these qualities: the floating quality, the warmth of the serif voice, the non-disruptive nature of overlays, and the calm confidence of every interaction.
