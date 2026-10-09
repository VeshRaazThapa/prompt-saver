# Chrome Web Store listing

**Name (≤75):** Prompt Saver — AI Prompt Manager for Claude, ChatGPT, Gemini & Codex
**Summary (≤132):** Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini. Type // in any chat box to insert.
**Category:** Productivity → Tools
**Language:** English
**Privacy policy URL:** https://prompt-saver-two.vercel.app/privacy
**Homepage URL:** https://prompt-saver-two.vercel.app/

**Description:**
Stop rewriting prompts you already perfected.

Prompt Saver keeps your best prompts in one library and puts them one keystroke away in the AI chats you already use.

• Type // in Claude, ChatGPT, Codex or Gemini to search your prompts, then press Enter to drop one into the chat box. Your message is never sent for you.
• Open the side panel for your whole library: search, star favorites, insert or copy with one click.
• Right-click any selected text → "Save to Prompt Saver", or save the draft you're typing.
• Every prompt is versioned on prompt-saver-two.vercel.app, and the same library is available in Claude Code via MCP.
• Light and dark themes, full keyboard support.

Privacy: the // check runs locally in your browser. Text is sent to Prompt Saver only when you save a prompt. No ads, no tracking, nothing sold.

**Permission justifications:**
- storage: cache your prompt library so the picker opens instantly
- sidePanel: the prompt library panel
- contextMenus: "Save to Prompt Saver" on selected text
- Host access (claude.ai, chatgpt.com, gemini.google.com): show the // picker and insert prompts into the chat box
- Host access (prompt-saver-two.vercel.app): sync with your Prompt Saver account

**Single purpose:** Save and insert AI prompts.
**Remote code:** No. All JavaScript ships in the package.
**Data use disclosures:** Personally identifiable info (email, via the website account) and website content (only prompt text the user saves). Not sold, not used for unrelated purposes, not used for creditworthiness. Certify compliance with the Limited Use policy.

## Assets (in `store/assets/`, regenerate with `npm run store-assets`)

| File | Slot |
|---|---|
| `public/icon/128.png` | Store icon (128×128, 96px art + 16px padding) |
| `screenshot-1-picker.png` | Screenshot 1 — // picker in a chat + side panel (1280×800) |
| `screenshot-2-library.png` | Screenshot 2 — side panel library |
| `screenshot-3-save.png` | Screenshot 3 — save form |
| `screenshot-4-sites.png` | Screenshot 4 — supported sites / onboarding |
| `screenshot-5-dark.png` | Screenshot 5 — dark mode |
| `promo-small-440x280.png` | Small promo tile (440×280) |
| `promo-marquee-1400x560.png` | Marquee promo tile (1400×560, optional) |

The chat page in the screenshots is a neutral mock (`store/chat-mock.html`) with sample prompts (`store/stub-data.mjs`). No third-party branding appears in any asset.

## Publishing steps

1. `npm run zip` → upload `.output/prompt-saver-extension-<version>-chrome.zip` as a **new item** in the [developer dashboard](https://chrome.google.com/webstore/devconsole). Do not submit yet.
2. Copy the item ID the dashboard assigns (32 letters a–p).
3. In Vercel → prompt-saver → Settings → Environment Variables, set `NEXT_PUBLIC_EXTENSION_IDS` (Production) to that ID. Add your unpacked dev ID after a comma if you want it to keep working. Redeploy: the value is inlined at build time.
4. Install the uploaded build (or load `.output/chrome-mv3` unpacked with the same ID) and run `docs/smoke-checklist.md` against production.
5. Fill in the listing above, upload the assets, complete the Privacy practices tab, and submit for review.
