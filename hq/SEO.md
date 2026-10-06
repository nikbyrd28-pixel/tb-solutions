# SEO — how the work gets done

Everything on the site that targets a search is **generated**. You edit data, run two commands,
and the pages, sitemap and llms.txt rebuild. Nobody hand-writes a landing page again.

```
tools/seo-data.mjs     ← the only file you edit: services, trades, towns, guides
tools/seo-build.mjs    ← turns that into pages + sitemap.xml + llms.txt
tools/seo-check.mjs    ← the quality gate; fails the build on thin or broken pages
```

```bash
node tools/seo-build.mjs && node tools/seo-check.mjs
```

**Never hand-edit anything under `/services/`, `/for/` or `/guides/`.** The build overwrites it.
Hand-built pages (`/`, `/receptionist/`, `/offers/`, `/leads/`, …) are left alone and stay in the
sitemap — the checker reports their problems as notes rather than failing on them.

## Research — keywords and links (the weekly research run)

Two tables, both shown in HQ → Agents under the SEO card:

- `seo_keywords` — phrases a trades owner around Chester County actually types, with the
  evidence (Google autocomplete, People-also-ask, a competitor's title, the rank log) and the
  page they belong on. The build run reads `status = 'new'` rows first when picking the next
  backlog item and flips them to `building` / `live`. No keyword without evidence: a phrase you
  made up is not a keyword.
- `seo_links` — real places tbsol.net can earn a link or citation from: local directories,
  Chamber of Commerce, trade associations (PHCC, local plumbing/HVAC groups), supplier
  "find a pro" pages, local press, podcasts and guest-post targets. Each row says what Nick
  must do (`how`) and what it costs. Most need a human to sign up, so the agent queues and
  Nick taps Done. Only pages that exist and that you have actually opened — never a guessed URL.

## What's live now

| Cluster | Pages | Targets |
|---|---|---|
| `/services/` | 4 + hub | "ai receptionist for contractors", "local services ads management", "google review automation", "websites for plumbers" |
| `/for/` | 3 | "answering service for plumbers / HVAC / electricians" + Chester County |
| `/guides/` | 2 + hub | "what a missed call costs a contractor", "contractors weekend calls" |

All 11 pass the gate: unique titles under 62 characters, unique descriptions, one `<h1>`,
canonical, BreadcrumbList + FAQPage (+ Service / Article) schema that parses, 300+ real words,
3+ internal links, no mobile overflow.

## Adding a page

1. Open `tools/seo-data.mjs`, add an entry to `SERVICES`, `TRADES` or `GUIDES`.
2. `node tools/seo-build.mjs && node tools/seo-check.mjs`
3. Fix whatever it fails on. Commit.

**The one rule that beats all the others: never add an entry you have nothing real and specific
to say about.** Thin, mad-libbed pages get filtered and drag the whole domain down. An empty slot
costs nothing. If you cannot write 400 words a plumber would actually read, skip it.

## Prices

They live once, in `SERVICES` in `seo-data.mjs`, and they must match `/offers/` exactly:

| | Setup (first 5) | Setup (list) | Monthly |
|---|---|---|---|
| Never Miss a Call | $297 | $497 | $197 |
| Lead Engine | $297 | $497 | $147 |
| Review Engine | — | — | $97 |
| Job-Ready Website | $497 | $497 | $47 |

If `/offers/` changes, change it here the same day. A price mismatch between two pages of your own
site is the kind of thing a shop owner notices and never mentions — he just doesn't call back.

## The backlog, in order

1. **Town pages.** `/for/<trade>/<town>/` for the 16 towns. The template is ready; the data is in
   `TOWNS`. Only build the ones you can say something true about — a town where you have a client,
   a job, or a specific local fact. 48 generated-and-identical town pages is the exact failure mode
   that gets a site buried.
2. **More guides.** The two that exist are the backlink earners. Candidates with real substance:
   what an answering service actually costs vs a receptionist; how the Oct 2026 LSA rule change
   affects a small shop; what to do when your Google profile gets suspended.
3. **`/for/roofers/`, `/for/landscapers/`** once you have a client in either.
4. **Homeowner cluster** — "water heater leaking Pottstown" and similar. This brings homeowners,
   not buyers, so it is only worth building when you have shops to route those leads to. Keep it
   on a separate path so it never confuses the owner-facing pages.

## Backlinks

Nothing here is built yet, and it is the real constraint — on-page work is finished, off-page is not.
Where links realistically come from for a shop like this:

- Local business directories and the chamber of commerce (Pottstown, Phoenixville, West Chester).
- Supplier and partner pages — anyone you resell or integrate with.
- The trades schools and apprenticeship programs in the county.
- Guest posts on contractor-business sites, using the missed-call arithmetic as the hook.
- Your own clients' sites — a "site by" footer link, if they agree.

Track them somewhere real before chasing them, and never buy them.

## Google Business Profile

This outranks every page on this list. For "marketing chester county" and "plumber near me" alike,
the map pack sits above the first organic result, and review count and recency decide the map pack.
Pages cannot fix that. Reviews can.
