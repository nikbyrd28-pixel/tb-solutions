---
name: awesome-design-md
description: Library of 74 real-world design systems (Stripe, Linear, Vercel, Apple, Nike, Supabase, Notion, Airbnb, etc.) as DESIGN.md files — colors, typography, spacing, buttons, components. Use when the user says "make it look like <brand>", "use <brand>'s design system", "premium design reference", or wants a page that matches a known product's visual language.
---

# Awesome DESIGN.md — real design systems for AI-built UI

A DESIGN.md is a plain-text design-system document an AI agent reads before generating UI so the output is visually consistent with a real, high-quality product instead of generic "AI slop".

## How to use

1. Pick the closest reference for the brief. Browse `design-md/` — each folder is one brand and holds a `DESIGN.md` (plus a `README.md` with preview screenshots in some).
   - SaaS / dev tools: `linear.app`, `vercel`, `stripe`, `supabase`, `resend`, `posthog`, `raycast`, `warp`, `sentry`, `clickhouse`, `mintlify`
   - Consumer / lifestyle: `airbnb`, `nike`, `spotify`, `starbucks`, `uber`, `pinterest`, `apple`
   - Fintech: `stripe`, `revolut`, `wise`, `coinbase`, `kraken`, `mastercard`, `binance`
   - Luxury / automotive: `ferrari`, `lamborghini`, `bugatti`, `bmw`, `tesla`
   - Productivity: `notion`, `slack`, `superhuman`, `cal`, `miro`, `figma`, `framer`, `webflow`
   - AI: `claude`, `cursor`, `lovable`, `elevenlabs`, `mistral.ai`, `x.ai`, `together.ai`, `runwayml`
   - Retro: `dell-1996`, `nintendo-2001`
2. Read that `DESIGN.md` fully with the Read tool before writing any markup or CSS.
3. Extract and apply: color tokens, type scale and weights, spacing rhythm, border radius, button/card/input treatments, motion rules. Implement them as CSS variables or Tailwind config — do not eyeball.
4. Build the page in that language. Do not copy the brand's logo, wordmark, product names or copy — only the visual system (palette, type, spacing, component style).
5. If the user asks for a mix ("Linear dark mode with Stripe's gradients"), read both files and state which tokens come from which.

## Pairing with other skills

- `taste` → picks the design direction; this skill supplies the concrete tokens.
- `web-design-guidelines` → audit the result afterward for accessibility and interaction quality.
- `playwright-cli` → screenshot the built page and compare against the reference.

Source: https://github.com/VoltAgent/awesome-design-md (MIT, see LICENSE).
