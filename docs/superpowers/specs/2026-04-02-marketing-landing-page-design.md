# Marketing Landing Page — Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Author:** Claude + Bhesh
**Project:** Prompt Saver

---

## 1. Overview

### What
A single marketing/landing page at `/` that replaces the current prompt library as the first thing visitors see. The page sells the product, then links to the app (`/app` or `/prompts`).

### Goal
Convert visitors into users. The page should make someone think "I need this" within 5 seconds and click "Start Saving Prompts" within 30 seconds.

### Target Audience
General AI users — anyone who uses ChatGPT, Claude, Gemini, or other LLMs regularly. NOT developers or CLI users. These are people who do everything from a UI. They write prompts for work tasks: writing, analysis, hiring, content creation, research.

### Tone
Warm, clear, relatable. No jargon. No "developer" language. No technical terms. Speak to someone who writes AI prompts daily but wouldn't call themselves a "prompt engineer."

---

## 2. Page Structure (5 Sections)

### Section 1: Hero
**Layout:** Two columns — text left, app preview right (stacks on mobile)

**Copy:**
- Headline (Instrument Serif, italic accent): "Your prompts, *saved and searchable.*"
- Subheadline: "Stop losing your best prompts in chat history. Save, version, and find any prompt in seconds."
- CTA button (teal): "Start Saving Prompts →"
- Sub-CTA text: "Free forever. No account required."

**App Preview:** A styled browser window mockup showing the prompt library with 4 realistic prompt cards (Resume Analyzer, Code Review Template, API Doc Generator, Bug Report Classifier). Each card shows title, description, tag, time ago, and version number.

**Design notes:**
- No background gradients or decorative blobs
- The app preview IS the visual — it sells the product by showing it
- Sticky nav with frosted glass effect (backdrop-filter: blur)

### Section 2: Pain Points — "Sound familiar?"
**Layout:** Centered heading + 3 cards in a row (stacks on mobile)

**Copy:**
- Section title: "Sound familiar?"
- Subtitle: "You've been here before. We all have."
- Card 1: "The lost prompt" — "I had a perfect prompt for this... somewhere. Was it in ChatGPT? Notion? A Slack message?"
- Card 2: "The rewrite" — "I spent 20 minutes writing this prompt last week. Now I'm rewriting it from scratch because I can't find it."
- Card 3: "The better version" — "I improved this prompt yesterday but I accidentally overwrote the working version. Which one was better?"

**Design notes:**
- Each card has a colored icon background (red, amber, green) with an SVG icon (search, pencil, chart — not emojis, per DESIGN.md)
- Cards have hover shadow transition
- No "developer" framing — these are universal AI user pains

### Section 3: How It Works — "Three steps. That's it."
**Layout:** 3 steps in a row with a connecting gradient line (hidden on mobile)

**Steps:**
1. **Save** — "Paste your prompt, add a title and tags. Done in 10 seconds."
2. **Version** — "Every edit is automatically versioned. Compare any two versions side by side."
3. **Find** — "Search by any word in your prompt — title, content, or tags. Instant results."

**Design notes:**
- White background section (contrast from stone-50)
- Teal numbered circles with box shadow
- Gradient connecting line between steps (teal-100 → teal → teal-100)

### Section 4: Features — "Built for how you actually work."
**Layout:** 2x2 grid of feature cards

**Features:**
1. **Version history** — "Every save is a snapshot. See what changed, when, and why. Restore any previous version with one click." (clock icon)
2. **Instant search** — "Full-text search across everything — titles, content, tags. Find any prompt in seconds, not minutes." (search icon)
3. **Tags & favorites** — "Organize by project, purpose, or whatever makes sense to you. Star your go-to prompts for quick access." (tag icon)
4. **Zero friction** — "No account, no API key, no onboarding wizard. Open Prompt Saver and start saving prompts. Literally." (lightning icon)

**Design notes:**
- Each feature is a horizontal card: icon left, text right
- Icons in teal-50 rounded squares
- Cards have hover shadow transition
- SVG stroke icons, not emojis (per DESIGN.md anti-patterns)

### Section 5: Final CTA
**Layout:** Centered text with CTA button

**Copy:**
- Headline: "Your prompts deserve better than a Notion doc."
- Subtitle: "Start building your prompt library today. It takes 10 seconds."
- CTA button: "Start Saving Prompts →"
- Sub-CTA: "Free. No signup. Works in your browser."

**Design notes:**
- Subtle gradient background (stone-50 → teal-50/F0FDFA)
- Same CTA button style as hero (teal, box shadow)
- Footer below with "Built by Maitri · GitHub" link

---

## 3. Navigation

**Sticky nav** with frosted glass effect:
- Left: "Prompt Saver" (Instrument Serif logo)
- Right: "Start Saving Prompts →" (teal CTA button)
- No other nav links — single page, single action

---

## 4. Routing Change

The current app lives at `/` (prompt library). With the marketing page:

| Route | Content |
|-------|---------|
| `/` | Marketing landing page (new) |
| `/app` | Prompt Library (moved from `/`) |
| `/app/prompts/new` | Create prompt |
| `/app/prompts/[id]` | Edit prompt |
| `/app/prompts/[id]/versions` | Version history |
| `/auth/signin` | Sign in |

**All CTA buttons on the landing page link to `/app`.**

The nav on `/app` pages remains the existing app nav (Prompt Saver logo, search, + New Prompt). The marketing nav is only on `/`.

---

## 5. Responsive Behavior

| Element | Desktop (1024+) | Tablet (768) | Mobile (375) |
|---------|-----------------|-------------|-------------|
| Hero | 2 columns | 2 columns (narrower preview) | 1 column (text → preview stacked) |
| Pain cards | 3 columns | 3 columns | 1 column stacked |
| Steps | 3 columns + line | 3 columns + line | 1 column, no line |
| Features | 2x2 grid | 2x2 grid | 1 column stacked |
| Nav | Full width | Full width | Full width, smaller text |

---

## 6. Typography (from DESIGN.md)

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Nav logo | Instrument Serif | 22px | 400 |
| Hero headline | Instrument Serif | 52px (36px mobile) | 400 |
| Section headings | Instrument Serif | 36px (28px mobile) | 400 |
| Body text | DM Sans | 16-18px | 400 |
| Card titles | DM Sans | 15-16px | 600 |
| Card descriptions | DM Sans | 13-14px | 400 |
| CTA buttons | DM Sans | 16px | 500 |
| Sub-CTA text | DM Sans | 13px | 400 |
| App preview version labels | JetBrains Mono | 9px | 400 |

---

## 7. Colors (from DESIGN.md)

- Primary CTA: `#0D9488` (teal-600), hover `#0F766E` (teal-700)
- CTA shadow: `rgba(13,148,136,0.2)`
- Background: `#FAFAF9` (stone-50)
- Section alternate: `#FFFFFF` (how it works section)
- Gradient CTA section: `#FAFAF9` → `#F0FDFA`
- Text primary: `#1C1917` (stone-900)
- Text secondary: `#78716C` (stone-500)
- Text tertiary: `#A8A29E` (stone-400)
- Borders: `#E7E5E4` (stone-200)
- Pain icon backgrounds: `#FEF2F2` (red-50), `#FFFBEB` (amber-50), `#F0FDF4` (green-50)
- Feature icon background: `#F0FDFA` (teal-50)
- Tag highlight: `#CCFBF1` (teal-100)

---

## 8. Words to Use / Avoid (from positioning)

**Use:** prompts, save, find, version, search, your, instantly, free, no signup
**Avoid:** developer, CLI, IndexedDB, local-first, Next.js, AI-powered, platform, unlock, supercharge, comprehensive, robust, seamless, prompt engineering

---

## 9. Copy Guidelines

- Lead with pain, not product
- Use "you" and "your" — not "we" or "our"
- Specific > vague ("10 seconds" not "quickly", "in seconds" not "with ease")
- Real scenarios in pain cards — things people actually experience
- No emojis in body text (DESIGN.md anti-pattern) — only in pain card icons where they serve as visual markers
- Ellipsis character `…` not three dots `...`

---

## 10. Implementation Notes

- This is a static page — no IndexedDB, no hooks, no client-side state
- Can be a server component (no 'use client' needed)
- The app preview is pure HTML/CSS, not a screenshot
- All animations use `transition` only — no keyframe animations, no scroll-triggered effects
- `prefers-reduced-motion` respected via globals.css

---

## 11. Success Criteria

The landing page is complete when:
1. Visitor understands what Prompt Saver does within 5 seconds of landing
2. All 5 sections render correctly on desktop, tablet, and mobile
3. CTA buttons link to `/app` (the prompt library)
4. No technical jargon visible anywhere on the page
5. Page follows DESIGN.md completely (fonts, colors, spacing, motion)
6. No AI slop patterns (no purple gradients, no centered-everything, no generic hero copy)
7. Build passes, Lighthouse performance score > 90
