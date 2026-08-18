# YTS Automotive

Single-page funnel for a mobile automotive locksmith — car key replacement,
transponder and smart-key programming, spare keys, lockouts.

Static site. No build step, no dependencies: `index.html` is the whole thing.

## Before it goes public

Find-and-replace these placeholders in `index.html` (each one appears in the
copy, the links **and** the JSON-LD structured data, so one pass per string
updates SEO too):

| Placeholder | Replace with |
| --- | --- |
| `(555) 555-5555` | the real number, as customers should read it |
| `+15555555555` | the same number in E.164, for `tel:` and `sms:` links |
| `Your City, ST` / `Your City` | the city and state served |
| `ytsautomotive` | the real Instagram handle |
| `https://ytsautomotive.com` | the live domain (canonical, og:url, JSON-LD) |

Then swap the service-area chips in the `#area` section for the towns actually
covered — plain-text local names are the highest-value on-page SEO signal a
mobile trade has — and drop a hero photo at `img/hero.jpg` (see `img/README.md`).

## Pricing shown on the page

| Service | Price |
| --- | --- |
| Spare key (customer still has a working key) | from $50 |
| Key / fob programming | $100–$200 |
| Mobile service call | $100–$150 |

These live in three places: the `#pricing` cards, the FAQ answers, and the
`hasOfferCatalog` block in the JSON-LD. Change all three together or the rich
result will disagree with the page.

## How the lead capture works

There is no backend. The quote form composes an SMS with the vehicle details
pre-typed and opens the visitor's messaging app pointed at `SMS_TO` (bottom of
`index.html`). Leads arrive as ordinary texts on a phone — nothing to host,
nothing to log into, and it converts better than a form that emails a stranger.

Every CTA is either that text flow or a straight `tel:` link, including a
sticky call bar pinned to the bottom of the viewport on mobile.

## Deploy

Vercel, framework preset "Other". Output is the repo root; no build command.

## Where this lives

This folder is also the seed for the standalone `yts-automotive` repo: copy it
out, `git init`, and it is a complete site with nothing to strip. `robots.txt`
and `sitemap.xml` only take effect from a domain root, so they do nothing while
the folder is served under `tbsol.net/clients/yts/` — they are here so the
standalone copy is ready the moment it gets its own domain.
