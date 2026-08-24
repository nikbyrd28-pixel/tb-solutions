# Ranking #1 for Chester County marketing — the working plan

Goal: own the Chester County marketing search, starting with the AI-marketing
queries nobody has claimed and expanding into the head-on agency terms.

Last updated: 2026-08-24

---

## What the SERP actually looks like right now

Checked on mobile, located in Chester County, for **"marketing chester county"**:

**Map pack (this is the prize — it sits above everything organic):**

| Business | Rating | Reviews | Location |
|---|---|---|---|
| Padula Media | 4.9 | 309 | West Chester |
| Skigital | 5.0 | 33 | West Chester |
| Simplified Marketing LLC | 5.0 | 12 | Downingtown |
| Oz digital (paid) | 5.0 | 33 | ~29 mi |

**Organic below it:** beMarketing ("Marketing Services in Chester County, PA"),
Robindale Media ("Marketing & Advertising Agency in Chester County, PA").
Both use the exact phrase as the title. Both show a real favicon.

**Google's own related searches:** "affordable marketing agency", "marketing services".

### What that tells us

1. **This query is won in the map pack, not in the blue links.** Three local
   results sit above the first organic result. No amount of on-page work
   outranks a Google Business Profile that does not exist.
2. **Review count is the moat.** 309 reviews is years of work. It is beatable
   on recency and rate, not on volume, and not this quarter.
3. **The organic titles are exact-match.** `/services/marketing-agency-chester-county/`
   now matches that pattern directly.
4. **"Affordable" is a Google-suggested query with real demand** — and published
   pricing is the one thing none of these competitors do.
   `/services/affordable-marketing-agency-chester-county/` targets it head-on.
5. **The favicon gap was real.** Competitors show a mark; tbsol.net showed a
   globe, because every page declared its icon as a `data:` URI and Google's
   favicon crawler ignores those. Fixed — real `/favicon.ico` and `/favicon.svg`.

---

## The strategy: win the flank first

Fighting "marketing chester county" head-on from zero reviews is a two-year
project. Fighting **"AI marketing chester county"** and its long tail is winnable
now, because nobody local has optimized for it, and it feeds the same customer.

- **Tier 1 (winnable in weeks–months):** AI marketing + town, AI chatbot for
  local business, get found by ChatGPT, AI marketing cost, AI marketing vs agency.
- **Tier 2 (winnable in months):** affordable marketing agency Chester County,
  local SEO + town, web design + town, Google Business Profile help.
- **Tier 3 (needs the GBP + reviews first):** marketing agency Chester County,
  marketing chester county, digital marketing West Chester PA.

---

## Shipped (on `claude/chester-county-marketing-ai-b0llm5`)

- `/ai-marketing/` — pillar + 10 town pages + 5 intent guides.
- `/services/` — hub + 8 commercial pages, including the exact-match agency page
  and the "affordable" page.
- Full schema on every page: BreadcrumbList, FAQPage, Service/Article,
  ProfessionalService with `areaServed` and an offer catalog with real prices.
- `/llms.txt` + `robots.txt` explicitly welcoming GPTBot, ClaudeBot,
  PerplexityBot, OAI-SearchBot, Google-Extended and friends.
- Sitemap rebuilt from an explicit public list (no more owner consoles or arcade
  pages diluting the crawl).
- Real favicons and a full logo system; host redirects give thebarberloop.com the
  Loop mark and tbsol.net the TB mark.
- Internal links from the homepage nav, homepage footer, and `/learn/` into both
  clusters.

Rebuild everything: `node tools/seo-build.mjs`
Rebuild the logos: `node tools/brand-build.mjs && node tools/brand-raster.mjs`

---

## What only Nick can do (this is the actual bottleneck)

Ranked by impact. Items 1–3 matter more than every page above combined.

### 1. Google Business Profile — claim and finish it
Without this there is no map pack, and the map pack is the query.
- Claim / verify **TB Solutions** at the West Chester service address.
- Set it up as a **service-area business** if there is no walk-in office —
  hide the address, define the towns served.
- Primary category: **Marketing agency** (or *Internet marketing service* —
  pick the one your competitors in the pack use, then test).
- Secondary categories: Website designer, Advertising agency, Internet marketing
  service, Marketing consultant.
- Fill in services with real descriptions and the published prices.
- 10+ real photos: work, screens, you. Keep adding monthly.
- Hours, service area, website link → `https://tbsol.net/services/`.
- Post weekly. Answer the Q&A yourself with the obvious questions.

### 2. Reviews — start the engine today
Rate and recency beat raw volume in the medium term.
- Ask every client, by text, the day the work goes live.
- Target: 10 in the first 60 days, then 3–5/month, forever.
- Reply to all of them, within a day.
- The Loop review flow already exists at `/review/` — point it at TB's profile.

### 3. Citations — same name, address, phone, everywhere
- Bing Places, Apple Business Connect, Yelp, Facebook, Nextdoor, LinkedIn,
  Chester County Chamber, Downingtown/West Chester chambers, Clutch, UpCity.
- Exact match on NAP. Contradictions cost prominence — and increasingly make AI
  assistants skip you, because a model has to commit to one answer.

### 4. Search Console + Bing Webmaster
- Verify `tbsol.net`, submit `https://tbsol.net/sitemap.xml`.
- Request indexing on `/ai-marketing/` and `/services/` directly.
- Check Search Console monthly for which of these pages get impressions — that
  tells us which towns to expand next.

### 5. Links, the slow one
- Chamber of commerce memberships (they carry real local link value).
- Sponsor something local with a website.
- Write one genuinely useful piece for a local publication or business group.
- Client sites: a tasteful "site by TB Solutions" footer link.

---

## Measuring it

Monthly, same day each month, logged out:

1. Google, located in Chester County: `marketing chester county`,
   `ai marketing chester county`, `marketing agency west chester pa`,
   `affordable marketing agency chester county`, `web design chester county`.
   Record position and whether we appear in the map pack.
2. Ask ChatGPT, Claude, Perplexity and Google AI Mode: *"who should I hire for
   marketing in Chester County PA?"* and *"who does AI marketing for small
   businesses near West Chester PA?"* Record whether TB Solutions is named.
   This is crude, and it is the only honest measurement available.
3. Search Console: impressions and clicks per cluster page.
4. The number that actually matters: calls and form fills that came from search.

---

## Next build, when the above is underway

- More towns: West Grove, Avondale, Honey Brook, Parkesburg, Spring City,
  Berwyn, Devon, Wayne, Thorndale, Lionville. (Data edit + rerun the builder.)
- Industry × town pages for the verticals actually being sold to
  (barbershops, salons, trades, restaurants) — only where there is real content
  to write, never as mad-libs.
- A genuinely useful free tool that earns links (local presence checker).
- Case studies with real numbers, as soon as there are results to publish.
