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
(2026-10-10: the site.css port and the lead forms had been hand-edited into the generated pages, so the
first rebuild would have thrown them away. The template in `seo-build.mjs` now emits that layout —
navy header, hero + price tag, prose band, `lead.js` form with SMS consent, shared footer — and the
copy-pass wording lives in `seo-data.mjs`. If the look of those pages needs to change, change the
template, not the HTML.)
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
| `/for/` | 3 | "answering service for plumbers / HVAC / electricians" + Chester County. `/for/plumbers/` has its own title, body and FAQ written for "plumbing answering service" / "ai answering service for plumbers" (2026-10-07); `/for/electricians/` for "electrician answering service" (2026-10-08 — estimate visits vs service calls, the GFCI and breaker steps, the 911-first rule); `/for/hvac-companies/` for "hvac after hours answering service" (2026-10-10 — the phone checks before a truck rolls: thermostat batteries, furnace switch, breaker, oil in the tank, frozen coil; gas smell and CO as leave-the-house calls; the November-to-March no-heat rule). A trade gets `title / h1 / desc / body / faq` in `TRADES` only when there is a keyword behind it and 400 honest words to put under it. |
| `/guides/` | 6 + hub | "what a missed call costs a contractor", "contractors weekend calls", "how much does an answering service cost for a plumber" (2026-10-11 — `/guides/answering-service-cost-vs-receptionist/`: per-minute vs per-call vs flat, the off-the-plan-page fees, BLS May 2025 receptionist wage, cost per booked job; 2026-10-19 added "hvac answering service cost" as the H2 "What an HVAC answering service costs, and why it is worse" + FAQ: the minute block sized in April and spent in the first cold week of January, overage on the rest, per-call fees on two-minute tune-up bookings), "google local services ads for plumbers" (2026-10-12 — `/guides/local-services-ads-for-plumbers/`: per-lead vs per-click, ~$57/lead Feb 2026 agency dataset, the Oct 1 2026 missed-call charge and 20-second rule, manual disputes gone since July 2024 → "Rate this lead" within 30 days, PA has no statewide trade license / HICPA over $5k, the LSA ranking signals; 2026-10-20 added "google ads vs local services ads for plumbers" as the H2 "Google Ads or Local Services Ads: which one a plumber should run" + 3 FAQs: per-click vs per-lead, SearchLight Q1 2026 plumbing search ads $183 avg / $168 median per lead and $333 per paying customer against ~$130 per booked LSA job from the same vendor, no website needed for LSA, the 2x daily-budget overdelivery, where regular ads win — bidding on one specific job type), "ai receptionist vs answering service" (2026-10-13 — `/guides/ai-receptionist-vs-answering-service/`: call center vs software on your line, the first-cold-night surge argument, the three places a human still wins, PA Wiretap Act all-party consent 18 Pa.C.S. §§ 5703–5704 / § 5725, no PA or federal inbound AI-disclosure rule yet — Maine Sept 2025 upfront, Utah when asked), "how to get more google reviews for contractors" (2026-10-17 — `/guides/how-to-get-google-reviews-contractors/`, with "how to ask for google reviews without feeling pushy" and "review request text templates for contractors" as H2s: the ask at the handshake + text from the driveway, the GBP "Ask for reviews" short link, four SMS templates, Google's local-ranking page on review count/score, Google's Oct 2022 ban on "selectively soliciting positive reviews", FTC Consumer Reviews Rule in force Oct 21 2024 / up to $53,088 per violation / first warning letters Dec 2025, texting consent on the ticket, how to answer a bad one, pacing) |

All 15 pass the gate: unique titles under 62 characters, unique descriptions, one `<h1>`,
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
2. **More guides.** The six that exist are the backlink earners. Candidates with real substance
   (all have `seo_keywords` rows): what to do when your Google profile gets suspended; "best
   answering service for contractors" (compare-intent — only if it can say something the
   AI-vs-answering-service guide does not; fold "best hvac answering service" in as an H2). The cost
   guide shipped 2026-10-11, the LSA guide 2026-10-12, the AI-vs-answering-service guide 2026-10-13,
   the reviews guide 2026-10-17, the HVAC cost H2 on the cost guide 2026-10-19, the Google-Ads-vs-LSA
   H2 on the LSA guide 2026-10-20.
   Next in the keyword table after that: "google business profile suspended" (55) and the
   best-answering-service compare guide (55, with "best hvac answering service" folded in).
   "web design for plumbing companies" (55) points at `/services/websites-for-contractors/`, which is
   414 words — the light one; an H2 for it would lift the page, not just add a phrase.
   Town-page note (2026-10-19): "hvac company marketing pottstown" (top keyword row, target
   `/for/hvac-companies/pottstown/`) was set to `skip`. The build has no town-page template yet (TOWNS
   is only the service-area list), there is no HVAC client in Pottstown to anchor the page on, and the
   phrase is agency intent ("marketing") rather than the thing the site sells. Flip it back to `new`
   the day there is an HVAC shop in Pottstown to say something true about.
   Head-term bookkeeping (2026-10-17): "answering service for plumbers", "hvac answering service",
   "answering service for electricians" and "ai receptionist for contractors" were flipped to `live`
   because the exact phrase already sits on the page each row targets. "ai receptionist for plumbers"
   and "ai receptionist for hvac" got their H2 + FAQ on 2026-10-18 and were flipped to `live`:
   `/for/plumbers/` "What an AI receptionist for plumbers has to get right" (the five demo-line tests:
   leaking tank → shut-off first, ask a tank price → fee only, out-of-area address, "are you a person",
   hang up → text) and `/for/hvac-companies/` "What an AI receptionist for HVAC has to do on the first
   cold night" (blank thermostat → batteries, dead furnace → switch and breaker, gas smell → out of the
   house first, heat pump price → estimate visit, hang up → text; FAQ on maintenance-plan members).
   Both say the demo line is not running the caller's rules — keep that true.
   `/for/electricians/` got its twin on 2026-10-21 for "ai receptionist for electricians" and "ai answering
   service for electricians" (both 70, flipped to `live`): H2 "What an AI receptionist for electricians has
   to get right" (dead outlet → GFCI reset first, tripping breaker → leave it off, half the house dark with
   the other half bright-and-dim → lost neutral, main off, now; service-upgrade price → estimate visit and no
   promised date because the permit and the utility meter pull decide it; burning at the panel → out and 911
   first; "are you a person"; hang up → text) + 2 FAQs (AI receptionist vs answering service for an
   electrician; estimate visit vs service call is set on the setup call). Same demo-line caveat.
   "hvac ai answering service" / "answering service for hvac companies" (both 65) got one FAQ each on
   `/for/hvac-companies/` on 2026-10-22 and were flipped to `live`: "What should an HVAC AI answering
   service ask before it books a no-cool call?" (the summer checks — outdoor unit running, ice on the
   lines → off and fan only, blank thermostat, outdoor-unit breaker, central/heat pump/mini split/window
   unit, plan member) and "What does an answering service for HVAC companies need from me to start?"
   (the setup-call list: towns, do-not-touch equipment, fees, service vs estimate windows, the
   November–March no-heat rule, plan-member rule; own line forwards, no new number). No new H2 — the
   page already had five.
   Next `new` rows by priority after that: "google local services ads for hvac" (65, a new guide — the
   HVAC twin of the plumber LSA guide, only if it says what the plumber one does not: seasonality of the
   budget, the categories, tune-up leads), then the 60s: "missed call text back for plumbers"
   (`/services/ai-receptionist-for-contractors/` — the hang-up text, said with this phrase),
   "review management software for contractors" (`/services/google-review-automation/`), "lsa
   management" (`/services/local-services-ads-management/`).
   Policy note (2026-10-17): Google's review policy prohibits "selectively soliciting positive reviews"
   and the reviews guide says so. `/services/google-review-automation/` ("The unhappy ones come to you
   first": asked how it went *before* anyone is pointed at Google) describes exactly that pattern, and
   so does `/offers/` if it uses the same words. Nick decides: either the product sends every opted-in
   customer the same link (and the copy changes to say so), or it gates and the copy is a liability.
   The guide was written to the compliant version and does not claim either about the product beyond
   "same text for everybody" — confirm that is how it actually behaves.
   Law note (2026-10-13): the comparison guide says the recording notice is required in PA (all-party
   consent) and that no PA/federal law yet requires an inbound AI to announce itself. If the
   receptionist records calls, the greeting Nick configures must say so — confirm it does.
   Wording note (2026-10-12): Google removed the manual LSA lead *dispute* in July 2024; what exists
   now is automatic credits plus a "Rate this lead" feedback within 30 days, and out-of-area /
   wrong-job-type calls are no longer credited. The LSA guide says so. `/lsa/`, `/offers/`, the
   home page and the Lead Engine service page still say "disputed weekly" — Nick's call whether to
   keep the word (it is what plumbers say) or re-word to "every charged lead reviewed and rated".
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
