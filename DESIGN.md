# Design System — Prompt Saver

## Product Context
- **What this is:** A local-first prompt management tool for saving, versioning, and searching LLM prompts
- **Who it's for:** Individual developers at Maitri who write and reuse structured LLM prompts
- **Space/industry:** Developer tools, AI/LLM tooling
- **Project type:** Web app (internal tool)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, clean, monospace accents. The tool gets out of the way and lets the writing breathe.
- **Decoration level:** Minimal — typography and spacing do all the work. No gradients, blobs, or decorative elements.
- **Mood:** A warm writing desk, not a cold dashboard. Calm, focused, professional. Think Cursor's warmth meets Linear's precision.
- **Reference sites:** Cursor (warm light tones), Linear (precision layout), Raycast (polish level)

## Typography
- **Display/Hero:** Instrument Serif — gives the product name gravitas; signals "this is a writing tool"
- **Body:** DM Sans — geometric, clean, slightly warmer than Inter. Excellent readability at all sizes.
- **UI/Labels:** DM Sans (same as body, weight 500-600 for labels)
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums`
- **Code/Editor:** JetBrains Mono — the best monospace for prompt writing, excellent ligatures
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ```
- **Scale:**
  | Level | Size | Weight | Line Height | Usage |
  |-------|------|--------|-------------|-------|
  | Display | 42px | 400 (Instrument Serif) | 1.15 | Product name, hero text |
  | H1 | 30px | 700 | 1.2 | Page titles |
  | H2 | 24px | 700 | 1.25 | Section headings |
  | H3 | 18px | 600 | 1.3 | Card titles, sub-sections |
  | Body | 16px | 400 | 1.6 | Paragraphs, descriptions |
  | Body Small | 14px | 400 | 1.5 | Secondary content, form inputs |
  | Caption | 13px | 500 | 1.4 | Labels, metadata |
  | Tiny | 11px | 600 | 1.3 | Section labels (uppercase, tracked) |
  | Code | 14px | 400 (JetBrains Mono) | 1.7 | Editor content |
  | Code Small | 12px | 400 (JetBrains Mono) | 1.5 | Inline code, hex values |

## Color

- **Approach:** Restrained — warm neutrals + one teal accent. Color is rare and meaningful.

### Light Mode
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `primary` | `#0D9488` | teal-600 | Primary buttons, links, active states |
| `primary-hover` | `#0F766E` | teal-700 | Button hover |
| `primary-light` | `#CCFBF1` | teal-100 | Active filter bg, tag highlight |
| `bg` | `#FAFAF9` | stone-50 | Page background |
| `surface` | `#FFFFFF` | white | Cards, nav, modals |
| `text` | `#1C1917` | stone-900 | Headings, primary text |
| `text-secondary` | `#78716C` | stone-500 | Descriptions, secondary content |
| `text-tertiary` | `#A8A29E` | stone-400 | Placeholders, timestamps, metadata |
| `border` | `#E7E5E4` | stone-200 | Card borders, dividers |
| `border-light` | `#F5F5F4` | stone-100 | Subtle separators, tag backgrounds |

### Dark Mode
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `primary` | `#2DD4BF` | teal-400 | Primary buttons, links |
| `primary-hover` | `#5EEAD4` | teal-300 | Button hover |
| `primary-light` | `#042F2E` | teal-950 | Active filter bg |
| `bg` | `#1C1917` | stone-900 | Page background |
| `surface` | `#292524` | stone-800 | Cards, nav |
| `text` | `#E7E5E4` | stone-200 | Primary text (off-white, not pure white) |
| `text-secondary` | `#A8A29E` | stone-400 | Secondary text |
| `text-tertiary` | `#78716C` | stone-500 | Tertiary text |
| `border` | `#44403C` | stone-700 | Borders |
| `border-light` | `#292524` | stone-800 | Subtle separators |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#16A34A` | Version saved, action confirmed |
| `warning` | `#D97706` | Unsaved changes indicator |
| `error` | `#DC2626` | Validation errors, delete actions |
| `info` | `#0D9488` | Auto-save status, tips (same as primary) |

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — not cramped like Linear, not airy like a marketing site
- **Scale:**

| Token | Value | Usage |
|-------|-------|-------|
| `2xs` | 2px | Hairline gaps |
| `xs` | 4px | Tag gaps, tight element spacing |
| `sm` | 8px | Inline padding, small gaps |
| `md` | 16px | Card padding, grid gaps, section spacing |
| `lg` | 24px | Page padding, section margins |
| `xl` | 32px | Large section spacing |
| `2xl` | 48px | Page section padding |
| `3xl` | 64px | Hero/major section padding |

## Layout
- **Approach:** Grid-disciplined — sidebar + main content, consistent alignment
- **Grid:** Single sidebar (192px) + fluid main on desktop. Full-width stacked on mobile.
- **Max content width:** 1280px (`max-w-7xl`)
- **Editor max width:** 896px (`max-w-4xl`)
- **Breakpoints:**
  - Mobile: 375px
  - Tablet: 768px (sidebar becomes horizontal pills)
  - Desktop: 1024px (sidebar visible)
  - Wide: 1440px
- **Border radius:**
  | Token | Value | Usage |
  |-------|-------|-------|
  | `sm` | 4px | Tags, small elements, filter buttons |
  | `md` | 8px | Buttons, inputs, cards |
  | `lg` | 12px | Modals, large cards, app mockup containers |
  | `full` | 9999px | Badges, pills, avatars |

## Motion
- **Approach:** Minimal-functional — every transition communicates a state change, nothing decorative
- **Easing:** enter(`ease-out`) exit(`ease-in`) move(`ease-in-out`)
- **Durations:**
  | Token | Value | Usage |
  |-------|-------|-------|
  | `micro` | 50-100ms | Color changes on hover/active |
  | `short` | 150ms | Button hover, link hover, filter active |
  | `medium` | 200ms | Card shadow on hover, border color changes |
  | `long` | 300ms | Modal enter/exit, panel transitions |
- **Rules:**
  - Only animate `transform`, `opacity`, `color`, `background-color`, `border-color`, `box-shadow`
  - Never animate layout properties (`width`, `height`, `top`, `left`)
  - Never use `transition: all` — list properties explicitly
  - Respect `prefers-reduced-motion: reduce`

## Interaction States
- **Hover:** `transition-colors duration-150 ease-out` on all interactive elements
- **Focus:** `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2` — never remove outline without replacement
- **Active/Pressed:** Slight darkening of background color
- **Disabled:** `opacity-50 cursor-not-allowed`
- **Touch targets:** Minimum 44x44px on all interactive elements (use padding if visual element is smaller)

## Component Patterns
- **Buttons:** 44px min-height, `rounded-md` (8px), transition on hover
- **Inputs:** 44px min-height, stone-200 border, teal focus ring
- **Cards:** White surface, stone-200 border, `rounded-lg` (12px), shadow on hover
- **Tags:** Pill-shaped (`rounded-sm`), stone-100 bg, primary-light bg for active
- **Empty states:** Warm copy + icon + primary CTA. Never just "No items."
- **Alerts:** Left border accent, semantic color background, specific actionable messages

## Anti-Patterns (Never Use)
- Purple/violet gradients
- Icons in colored circles as decoration
- Centered everything
- Uniform bubbly border-radius on all elements
- Generic copy ("Welcome to X", "Unlock the power of")
- Tailwind default blue (`blue-600`) — use teal
- Tailwind default gray — use stone
- `outline: none` without `focus-visible` replacement

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-21 | Initial design system created | Created by /design-consultation based on competitive research (Linear, Raycast, Cursor) and product context (prompt writing tool for developers) |
| 2026-03-21 | Warm stone neutrals over cold gray | Writing tools should feel calm and warm, like a desk — not clinical like a dashboard |
| 2026-03-21 | Teal accent over default blue | Distinguishes from every Tailwind default app while remaining equally professional |
| 2026-03-21 | Instrument Serif for display | Unusual for dev tools — signals "this is a writing tool" and gives the brand gravitas |
| 2026-03-21 | JetBrains Mono for editor | Best monospace for extended reading/writing of structured text |
