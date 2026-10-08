# Claude Code skills installed in this repo

Loaded automatically by Claude Code / Claude when working in this repo. Invoke with the Skill tool or by name (`/taste`, `/web-design-guidelines`, etc.).

## Design & front-end

| Skill | What it does | Source |
|---|---|---|
| `taste` | Anti-slop front-end: reads the brief, infers a design direction, ships non-templated landing pages / portfolios / redesigns | [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) |
| `frontend-design` | Anthropic's official front-end design guidance — typography, color, motion, distinctive aesthetic choices | [anthropics/skills](https://github.com/anthropics/skills) |
| `image-to-code` | Generate a design reference image first, analyze it, then implement the page to match it | [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) |
| `awesome-design-md` | 74 real design systems (Stripe, Linear, Vercel, Nike, Supabase…) as DESIGN.md token files — "make it look like X" | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) |
| `web-design-guidelines` | Audits UI code against Vercel's Web Interface Guidelines (a11y, focus, hit targets, contrast) and flags `file:line` issues | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |

## Testing

| Skill | What it does | Source |
|---|---|---|
| `playwright-cli` | Drive a real browser from the terminal — open pages, click, fill forms, screenshot, catch broken UI before you see it. Needs `npm install -g @playwright/cli@latest` on the machine running Claude Code. | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) |

## Memory

| Skill | What it does | Source |
|---|---|---|
| `mempalace`, `mempalace-recall`, `mempalace-task` | Persistent local memory across sessions (MCP server `mempalace` is registered in `.mcp.json`). Needs `uv tool install mempalace` then `mempalace init .` on the machine running Claude Code. | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) |

## Suggested flow for a new page

`taste` (direction) → `awesome-design-md` (tokens) → build → `web-design-guidelines` (audit) → `playwright-cli` (screenshot + verify)
