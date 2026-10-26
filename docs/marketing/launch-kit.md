# Prompt Saver — Launch Kit

Everything needed to put Prompt Saver (Chrome extension + web app + MCP server) in front of as many people as possible. Copy is ready to paste; edit the voice to sound like you.

**Links**
- Extension: https://chromewebstore.google.com/detail/phadmjhlepcflnjmbkobjigdflahhoko
- Website: https://prompt-saver-two.vercel.app/
- Source (MIT): https://github.com/VeshRaazThapa/prompt-saver

Add `?ref=<channel>` (e.g. `?ref=hn`, `?ref=ph`, `?ref=reddit-claudeai`) to every website link you post so you can see which channel converts.

---

## 0. Fix before posting anywhere

Big launches (Product Hunt, Hacker News) only happen once. Fix these first.

| # | Fix | Why |
|---|---|---|
| 1 | ✅ "Add to Chrome" on the homepage (nav, hero, extension section, final CTA, footer) | Done. |
| 2 | ✅ Demo clip: `extension/store/assets/demo-picker.mp4` and `.gif` (`npm run store-demo` to re-record) | Done. Still to do: upload the MP4 to YouTube and add the link as the Chrome Web Store promo video. |
| 3 | ✅ Demo GIF at the top of the GitHub README | Done. |
| 4 | Decide on a custom domain (optional, ~$10/yr) | `prompt-saver-two.vercel.app` looks like a side project. If you switch, it needs a new extension version (host permission), `NEXTAUTH_URL`, the Google OAuth authorized domain and the privacy URL updated — so do it *before* launches, or not at all. |
| 5 | Ask the first users for a Chrome Web Store rating | Listings with 0 ratings convert poorly. Ask friends/colleagues who actually use it for an honest review. |

---

## 1. Launch calendar

Spread launches out so each one gets your full attention for replying to comments (replying fast matters more than anything else on HN, PH and Reddit).

| Week | Channel | Notes |
|---|---|---|
| 1 | Directories batch (section 5) + Edge Add-ons store | Low effort, permanent backlinks, no timing pressure. |
| 1 | MCP directories (section 4) | The MCP angle is unusual for a prompt manager — uncrowded. |
| 2 | Reddit, one sub per day (section 3) | Never cross-post the same text on the same day. |
| 2 | X thread + LinkedIn post | Same day as the first Reddit post. |
| 3 | Show HN (Tue–Thu, ~8–10am US Eastern) | Lead with open source + MCP. |
| 4 | Product Hunt (Tue–Thu, goes live 12:01am Pacific) | Line up 10–20 people who'll leave a genuine comment on the day. |
| 5+ | Articles (dev.to, Hashnode, Medium), YouTube short, SEO pages | Long-tail traffic that keeps coming. |

---

## 2. Hacker News — Show HN

**Title** (≤80 chars):
> Show HN: Prompt Saver – type // in Claude/ChatGPT/Gemini to insert saved prompts

**URL:** the GitHub repo (HN prefers source over a landing page).

**First comment (post immediately after submitting):**
> Hi HN — I kept rewriting the same prompts (code review, commit messages, "explain this like I'm new to the codebase") and losing the good versions in chat history.
>
> Prompt Saver is a small open-source (MIT) prompt library:
>
> - Chrome extension: type `//` in Claude, ChatGPT or Gemini and a picker searches your library. Enter drops the prompt into the chat box — it never sends anything for you.
> - Every edit is versioned, so you can go back to the version that actually worked.
> - There's a remote MCP server, so Claude Code can search and save the same library from the terminal, and starred prompts show up as slash commands.
>
> Stack: Next.js, Neon Postgres, WXT for the extension. The `//` detection runs locally; text only leaves the browser when you save a prompt. No tracking.
>
> It's free. I'd really like feedback on the picker UX and what's missing for you to use it daily.

---

## 3. Reddit

Rules first: most subs ban pure self-promotion. Read each sub's rules, use the "Showcase"/"Self-promo" flair or weekly thread where one exists, post as a person ("I built…"), and stay in the comments for the first two hours. Lead with the GIF.

| Subreddit | Angle |
|---|---|
| r/ClaudeAI | `//` picker in claude.ai + MCP for Claude Code |
| r/ClaudeCode | MCP server, favourites as slash commands |
| r/ChatGPTPro | Reusing prompts across ChatGPT/Claude/Gemini |
| r/ChatGPT | Short, GIF-led, "I got tired of scrolling chat history" (check self-promo rules) |
| r/PromptEngineering | Versioning prompts like code |
| r/GeminiAI | Works in Gemini too |
| r/mcp | Remote MCP server with Bearer tokens, five tools |
| r/chrome_extensions | Built with WXT, MV3, side panel |
| r/SideProject, r/indiehackers | Build story, lessons from Chrome Web Store review / OAuth |
| r/opensource | MIT, self-hostable |
| r/productivity | Keystroke-saving angle, no jargon |

**Template (r/ClaudeAI):**

> **Title:** I made a free extension so I can type // in Claude and insert my saved prompts
>
> [GIF]
>
> I reuse a handful of prompts every day and kept digging through old chats to find the version that worked. So I built Prompt Saver:
>
> - Type `//` in the Claude chat box → search your prompts → Enter inserts it (doesn't send).
> - Side panel with your whole library, favourites, copy/insert.
> - Right-click selected text → "Save to Prompt Saver".
> - Every edit is versioned.
> - If you use Claude Code, the same library is available over MCP, and starred prompts become slash commands.
>
> Also works in ChatGPT and Gemini. Free and open source (MIT). Chrome Web Store: [link]
>
> What prompts do you find yourself retyping the most? Happy to take feature requests.

---

## 4. MCP directories (developer audience, low competition)

Submit the remote server `https://prompt-saver-two.vercel.app/api/mcp` (HTTP transport, Bearer token from Settings).

- Official MCP Registry — registry.modelcontextprotocol.io
- awesome-mcp-servers (GitHub, punkpeye) — open a PR
- Smithery — smithery.ai
- mcp.so
- Glama — glama.ai/mcp/servers
- PulseMCP — pulsemcp.com
- MCP Market — mcpmarket.com
- Cursor Directory — cursor.directory (MCP section)

**One-liner:** Personal prompt library over MCP — search, read, version and save your prompts from Claude Code; starred prompts become slash commands.

---

## 5. Directories and launch sites

Check each site's current terms before submitting: most offer a free listing, some charge for a faster review or a featured spot (skip the paid tiers to start).

**Product launch sites:** Product Hunt, Peerlist Launchpad, Uneed, DevHunt (dev tools), Fazier, Microlaunch, BetaList, Indie Hackers (Products), StartupBase, Launching Next, SideProjectors, Hacker News (section 2).

**AI tool directories:** There's An AI For That, Futurepedia, Toolify, FutureTools, TopAI.tools, AI Tools Directory (aitoolsdirectory.com), Insidr AI, AItoolnet, Easy With AI, AI Scout.

**Software alternatives (list as an alternative to AIPRM, PromptStash, TextExpander, Text Blaze):** AlternativeTo, SaaSHub, Slant, G2 (free profile), Capterra.

**Other extension stores (same codebase via WXT):**
- **Microsoft Edge Add-ons** — same Chrome zip, free developer account, separate review. Easiest extra distribution.
- Firefox Add-ons — `wxt build -b firefox`; needs testing (side panel → sidebar).

**Awesome lists on GitHub (PRs):** awesome-chatgpt, awesome-claude / awesome-claude-code, awesome-chrome-extensions, awesome-prompt-engineering, awesome-ai-tools.

**Reusable directory copy**

- **Name:** Prompt Saver
- **Tagline (≤60):** Type // to insert your saved prompts in any AI chat
- **Short (≤160):** Free prompt library for Claude, ChatGPT and Gemini. Type // in the chat box to search and insert your saved prompts. Versioned, open source, MCP-ready.
- **Long:**
  Prompt Saver keeps your best AI prompts in one versioned library and puts them one keystroke away. Type // in Claude, ChatGPT or Gemini to search your prompts and drop one into the chat box — nothing is sent for you. Save from any page with a right-click, browse the side panel, star favourites, and roll back to any earlier version. Developers can reach the same library from Claude Code through a remote MCP server. Free, open source (MIT), no ads or tracking.
- **Categories/tags:** Productivity, Prompt management, Chrome extension, ChatGPT, Claude, Gemini, Developer tools, MCP, Open source
- **Pricing:** Free

---

## 6. Product Hunt

- **Name:** Prompt Saver
- **Tagline:** Type // to insert your saved prompts in any AI chat
- **Topics:** Chrome Extensions, Productivity, Artificial Intelligence, Developer Tools, Open Source
- **Gallery:** `extension/store/assets/` screenshots + marquee tile, demo video first
- **Maker comment:**
  > Hey Product Hunt 👋 I built Prompt Saver because my best prompts kept getting lost in chat history. Now I type `//` in Claude, ChatGPT or Gemini, search, and the prompt drops straight into the box.
  >
  > What's inside: a versioned prompt library on the web, a Chrome extension with the `//` picker and a side panel, right-click saving, and an MCP server so Claude Code can use the same prompts.
  >
  > It's free and open source. I'd love to hear which prompts you reuse the most and what would make this part of your daily workflow.

---

## 7. X / Twitter thread

1. I kept losing my best AI prompts in chat history. So I built a fix: type // in Claude, ChatGPT or Gemini and your saved prompts appear. [GIF]
2. Enter drops the prompt into the chat box. It never sends for you, so you can tweak first.
3. Save anything with a right-click. Every edit is versioned, so the version that worked is never lost.
4. Use Claude Code? The same library is available over MCP, and starred prompts become slash commands. [screenshot]
5. Free, open source (MIT), no tracking. Chrome: [link] · Code: [link]

Tag: @AnthropicAI, @OpenAI, @GoogleDeepMind only where genuinely relevant; reply to "how do you manage prompts?" threads with the GIF instead of cold posting.

---

## 8. LinkedIn

> I shipped my first Chrome extension: Prompt Saver.
>
> If you use ChatGPT, Claude or Gemini at work, you probably have prompts you reuse every day — and you probably lose the good versions in chat history.
>
> With Prompt Saver you type // in the chat box, search your library, and the prompt drops in. Every edit is versioned, and developers can use the same library from Claude Code via MCP.
>
> Free and open source. Would love your feedback — and if you try it, a rating on the Chrome Web Store helps a lot.
>
> [link] [GIF]

---

## 9. Long-tail content (keeps bringing traffic)

**Articles (dev.to, Hashnode, Medium — cross-post with a canonical URL):**
- "How I built a Chrome extension that inserts prompts into Claude, ChatGPT and Gemini" (WXT, content scripts, contenteditable insertion)
- "Exposing your app to Claude Code with a remote MCP server" (Next.js + Bearer tokens)
- "Getting a Chrome extension past Web Store review" (and the OAuth Testing-mode trap)

**SEO pages on the website** (each a short page with the GIF and the Add to Chrome button):
- /save-chatgpt-prompts — "How to save and reuse ChatGPT prompts"
- /claude-prompt-library
- /alternatives/aiprm, /alternatives/text-blaze — honest comparisons

**Video:** 30-second YouTube Short / TikTok / Reels of the `//` flow; a 3-minute "set up Prompt Saver with Claude Code" walkthrough.

---

## 10. Track it

| Metric | Where |
|---|---|
| Installs, weekly users, impressions | Chrome Web Store dashboard → Analytics |
| Signups | `select date(created_at), count(*) from users group by 1 order by 1 desc` |
| Visits by channel | Vercel Analytics, filtered by `ref` |

Review weekly; double down on the two channels that bring signups, not just installs.
