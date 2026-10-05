# Pre-release smoke checklist (logged-in Chrome, production build)

Build: `npm run zip`. Load `.output/chrome-mv3` unpacked. Connect your account via the panel.

For each site — claude.ai, chatgpt.com, chatgpt.com/codex, gemini.google.com:
- [ ] Type `//` in the chat box → picker opens above the caret with your prompts
- [ ] Type a filter → list narrows; Enter inserts and removes `//query`; message NOT sent
- [ ] Multi-line prompt keeps its line breaks
- [ ] Picker "Save current draft…" opens the panel save form with the draft (or shows "Click the Prompt Saver icon")
- [ ] Panel Insert puts text in the chat box; Copy works
- [ ] Select text → right-click "Save to Prompt Saver" → panel form prefilled → Save → appears in list and on the website
- [ ] If an editor selector failed, fix it in `src/sites/<site>.ts` and re-run `npm test`

Account:
- [ ] Revoke the "Chrome extension" token in website Settings → panel shows Reconnect on next action
- [ ] Reconnect works; only one active "Chrome extension" token exists afterwards
