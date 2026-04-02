# Prompt Saver — Project Guidelines

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

Key rules:
- Use **stone** neutrals (not gray) — `stone-50` through `stone-900`
- Use **teal** accent (not blue) — `teal-600` primary, `teal-400` dark mode
- Use **DM Sans** for body, **Instrument Serif** for display, **JetBrains Mono** for editor
- All interactive elements need `transition-colors duration-150 ease-out`
- All interactive elements need `focus-visible:ring-2` accessibility ring
- Minimum 44px touch targets on all buttons, links, and inputs

## Deploy

When the user says "deploy", run these steps:
1. `git push origin <current-branch>`
2. `git checkout main && git merge <branch> && git push origin main`
3. `git checkout <branch>`

Vercel auto-deploys from `main`. No manual deploy step needed.
Production URL: https://prompt-saver-two.vercel.app/
