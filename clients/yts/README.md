# YTS Automotive

Single-page funnel for a mobile automotive locksmith in **Philadelphia, PA** —
car key replacement, transponder and smart-key programming, spare keys, lockouts.

Static site. No build step, no dependencies: `index.html` is the whole thing.

## Before it goes public

Find-and-replace these in `index.html`. Each string appears in the copy, the
links **and** the JSON-LD structured data, so one pass per string moves the SEO
with it:

| Placeholder | Replace with |
| --- | --- |
| `(215) 555-0142` | the real number, as customers should read it |
| `+12155550142` | the same number in E.164, for `tel:` and `sms:` links |
| `ytsautomotive` | the real Instagram handle |
| `https://ytsautomotive.com` | the live domain (canonical, og:url, JSON-LD) |

`555-01xx` is the reserved fictional range, so nothing in here can ring a
stranger while it's still a draft.

Then trim the neighborhood chips in `#area` to the ones he'll actually drive to,
and drop a hero photo at `img/hero.jpg` (see `img/README.md`).

## Two things to decide before advertising

**New Jersey is deliberately not in the service area.** Pennsylvania has no
statewide locksmith licensing; New Jersey requires a state locksmith license.
Camden and Cherry Hill are fifteen minutes from South Philly and it is tempting
to list them — don't, until that license exists. The copy, the FAQ and the
`areaServed` in the structured data all stop at the river on purpose.

**Proof of ownership is load-bearing, not legal boilerplate.** It appears in the
FAQ and the footer because a locksmith who advertises "we open any car" and says
nothing about ID reads like a problem. Keep it visible.

## Pricing shown on the page

| Service | Price |
| --- | --- |
| Spare key (customer still has a working key) | $50 |
| Key / fob programming | $100–$200 |
| Mobile service call | $100–$150 |

These live in three places: the `#pricing` cards, the FAQ answers, and the
`hasOfferCatalog` block in the JSON-LD. Change all three together or the rich
result will contradict the page — which is worse than having no rich result.

The spare-key block under the pricing cards is the margin play: a $50 spare is
an easy yes on a good day, and it is the only service here somebody buys when
nothing is wrong.

## How the lead capture works

There is no backend. The quote form composes an SMS with the vehicle details
pre-typed and opens the visitor's messaging app pointed at `SMS_TO` (bottom of
`index.html`). Leads arrive as ordinary texts on a phone — nothing to host,
nothing to log into.

The live preview box under the form shows the exact message before it sends.
That is the trust play: nobody taps a button marked "text" without seeing what
it is about to send on their behalf.

Every other CTA is a `tel:` link, including a call bar pinned to the bottom of
the viewport. Clicks on anything with `data-track` fire into `dataLayer` and
`fbq` if either exists, so a GA4 or Meta pixel can be pasted into `<head>` later
with no other edits.

## Local SEO, in order of payoff

1. **Google Business Profile**, set up as a *service-area business* (no storefront
   address shown) covering Philadelphia and the three collar counties. For a
   mobile trade this outranks the website itself for "car key replacement near me".
2. **Same name, number and hours everywhere** — GBP, this site, Instagram. Google
   cross-checks them, and a mismatched phone number quietly costs rankings.
3. **Reviews that mention the job and the neighborhood** ("keyed my Malibu in
   Fishtown"). Ask on site, right after the car starts — that is the only moment
   the customer is genuinely delighted.
4. The `FAQPage` and `Locksmith` structured data already on this page, which is
   what makes the price and Q&As eligible to show under the result.

## Where this lives

This folder is also the seed for the standalone `yts-automotive` repo: copy it
out, `git init`, and it is a complete site with nothing to strip. `robots.txt`
and `sitemap.xml` only take effect from a domain root, so they do nothing while
the folder is served under `tbsol.net/clients/yts/` — they are here so the
standalone copy is ready the moment it gets its own domain.

## Deploy

Vercel, framework preset "Other". Output is the repo root; no build command.
