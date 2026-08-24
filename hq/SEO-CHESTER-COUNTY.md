# Ranking #1 for Chester County marketing — the working plan

Goal: own the Chester County marketing search, starting with the AI-marketing
queries nobody has claimed and expanding into the head-on agency terms.

Last updated: 2026-08-24 (GBP confirmed claimed)

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
   outranks a Google Business Profile that is not finished and reviewed.
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

**Day 1 — 2026-08-24**

- `/ai-marketing/` — pillar + 16 town pages + 5 intent guides.
- `/marketing-for/` — hub + 5 vertical pages (barbershops & salons, restaurants,
  contractors & trades, professional services, gyms & studios).
- Titles cut to under 62 characters so Google stops truncating the brand off.
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

### 1. Google Business Profile — finish it (claimed 2026-08-24)
The profile exists. Claimed is not the same as competitive — an unfinished
profile ranks like a half-built one, because Google has nothing to match against.

**Everything below is written out ready to paste in `hq/gbp-paste-kit.md`** —
categories, the 738-character description, all 11 services with descriptions,
product tiles with prices, 8 seeded Q&As, a photo shot list, 12 weeks of posts,
review request texts and reply templates.

Order of work, highest leverage first:
- **Categories.** Primary → *Marketing agency*. Secondaries: Website designer,
  Internet marketing service, Advertising agency, Marketing consultant. This
  single field decides which searches you are eligible for at all.
- **Description + services + products.** All written; paste them.
- **10 photos**, then a few weekly. Never stock.
- **Seed the Q&A** yourself — ask from a second account, answer from the
  business. Free real estate that shows in the profile and nobody uses it.
- **Website link** → `https://tbsol.net/services/`.
- **Hours and service area**, including holiday hours.
- **Post weekly.** Twelve are written.

### 2. Reviews — this is now the top blocker
With the profile claimed, reviews are the thing standing between TB Solutions
and the map pack. Padula Media has 309. You do not beat that on volume this
year — you beat it on **rate and recency**, which Google weighs heavily.

- Ask every client by text within an hour of the work going live. Templates are
  in the paste kit.
- **Target: 10 in the first 60 days, then 3–5/month, forever.**
- Reply to every one within a day, naming the specific thing.
- The Loop review flow at `/review/` already exists — point it at TB's profile
  and the asking becomes automatic instead of remembered.

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

## The daily loop

A routine runs each morning and does one focused batch. The rule: never publish
a page there is nothing real to say on. When the backlog below is empty, the
loop switches to auditing and improving what is already live rather than
manufacturing filler.

### Backlog, in order

1. Towns still missing: Thorndale, Lionville, Devon, Wayne, Atglen, Elverson,
   Landenberg, Toughkenamon, Modena, Sadsburyville. (Data edit + rerun.)
2. Long-tail question pages from real search behaviour — "how much does a
   website cost in West Chester", "best time to post for a local business",
   "why is my Google listing not showing up".
3. Town × industry pages, but only for the combinations actually being sold to
   (barbershops in West Chester, contractors in Downingtown), never as a matrix.
4. A free tool that earns links: a local presence checker that grades a business
   on the things this site says matter.
5. Case studies with real numbers, the moment there are results to publish.
6. Refresh pass: re-read the oldest pages, update anything that has aged, cut
   anything that reads like filler.

### Every Monday

Run the measurement block below and append the results to
`hq/seo-rank-log.md`. If a page has had impressions for four weeks and no
clicks, the title and description are wrong — rewrite them rather than adding
another page.
