# TB Solutions — Ecosystem Map
*The one source of truth for what exists, where it lives, and whether it's alive. Updated Oct 4, 2026.*

## The business (what we sell)
**TB Solutions = the front office for the trades** (plumbers, HVAC, electricians). One hub, five offers, one bundle. The flywheel: Lead Engine rings the phone -> Receptionist books it -> Review Engine stacks reviews -> cheaper leads.

| Offer | Price | Funnel | Status |
|---|---|---|---|
| Never Miss a Call (AI receptionist) | $497 setup ($297 founding) + $197/mo | tbsol.net/receptionist/ | **LIVE** — demo (610) 998-6138 |
| Job-Ready Website | $497 build + $47/mo care | tbsol.net/websites/ | LIVE (selling) |
| Review Engine | $97/mo, no setup | tbsol.net/reviews/ | LIVE (selling; delivery = n8n flow, build on first sale) |
| Remodel Planner (blueprint-to-quote funnel) | $697 build + $67/mo, or $297 added to a website | tbsol.net/planner/ | LIVE (selling; delivery = DNE planner templatized, de-brand on first sale) |
| Lead Engine (Google LSA setup + management) | $497 setup + $147/mo (lead spend paid to Google directly) | tbsol.net/leads/ | LIVE (selling; delivery = LSA application, weekly tuning, dispute filing) |
| └ LSA migration front door (same offer, urgency angle: Google moved LSA into Google Ads, missed calls billable since Oct 1 2026) | sells Lead Engine, upsells Front Office | tbsol.net/lsa/ | LIVE — calculator + free-audit form → edge fn `lsa-intake` → table `lsa_leads` |
| **Google Rank Fix** (local SEO: free 17-point audit → 14-day fix; review activation, NAP cleanup, Apple Maps, trust links, GBP fields, site tags) | $697 fix + $97/mo | tbsol.net/rank/ | LIVE (selling; delivery = HQ → Work playbook per client, client watches `/audit/?t=…`) |
| Full Front Office (all three) | $797 setup + $297/mo | hub | LIVE (selling) |
| **Offer sheet** (all of the above on one page, printable) | — | tbsol.net/offers/ | LIVE — text this link to prospects |

## Live stack
| Piece | What | Where |
|---|---|---|
| Hosting | Vercel project `tb-solutions` → tbsol.net (auto-deploys `main`) | this repo |
| Database | Supabase **"Base"** `qgbjiqdwzgkjkmqyjsmc` | — |
| Receptionist brain | edge function `rx-agent` (Vapi webhook: persona, booking, SMS) | `receptionist/supabase/functions/rx-agent/` |
| Field-service sync | edge fn `rx-sync` — booked `rx_jobs` → Housecall Pro (per-client key in `rx_integrations`, set from HQ); Jobber planned | `receptionist/supabase/functions/rx-sync/` |
| SMS consent intake | edge function `rx-optin` + `/receptionist/sms-consent/` page | `receptionist/` |
| LSA audit intake | edge function `lsa-intake` → `lsa_leads` (set `NICK_PHONE` secret to get texted) | `lsa/supabase/` |
| Receptionist data | tables `rx_*` (businesses, services, jobs, calls, messages, optins, config) | Supabase |
| Secrets | `rx_config` table (Twilio keys, Vapi webhook secret) — env vars override | Supabase |
| Voice | Vapi — number (610) 998-6138 → rx-agent; provision new clients with `receptionist/vapi/provision.mjs` | dashboard.vapi.ai |
| SMS | Twilio — toll-free (833) 736-5726 (verification pending); trial = verified numbers only | console.twilio.com |
| Automation | self-hosted n8n — import `n8n/rx-weekly-report.json` (Mon 7am scorecard) | `n8n/` |
| **Owner app** | tbsol.net/receptionist/app/ — each client logs in to see jobs/calls/messages and edit what their receptionist says (`rx_owner_*` RPCs, invites via HQ) | `receptionist/app/` |
| **HQ (Nick's CRM)** | tbsol.net/hq/ — all leads + receptionist backend in one screen; RPCs `hq_*`, admins in `hq_admins` | `hq/` |
| **Work (client projects)** | HQ → Work — **+ New client** creates a project pre-loaded with the 17-step Rank Fix playbook (`hq_playbook`, editable in SQL); tap a step todo→doing→done→n/a, write the one-line finding; **Share audit** = `tbsol.net/audit/?t=<share_token>` — read-only client page via anon RPC `audit_public(token)` (never exposes phone/email/notes). Tables `hq_projects`, `hq_project_items`; RPCs `hq_project*` | `hq/supabase/013_hq_work.sql`, `audit/` |
| **Finder** | HQ → Finder — type a trade + town, Scan: edge fn `hq-finder` pulls shops from Google Places, opens each site, grades it (no site / no booking / mobile / stale / SSL), scores with Prospector rules, writes the opener + est. $/mo, files 50+ onto Today via `hq_finder_import`. Needs `GOOGLE_PLACES_KEY` in `rx_config` (saved from the tab) | `hq/supabase/functions/hq-finder/`, `hq/supabase/012_hq_finder.sql` |
| **Agents (the fleet)** | Prospector, SEO, GBP, Meta, Content, Review — HQ → Agents; posts in `agent_posts`, review texts via edge fn `rx-review` + pg_cron | `hq/AGENTS.md` |
| Analytics | `track.js` → `track-visitor` edge fn → `visitors`/`pageviews` | root |
| Onboarding | `receptionist/supabase/new_client_template.sql` — 20-min new client | — |

## Clients (keep working, bill monthly)
| Client | What they have | Where |
|---|---|---|
| D N E Contracting (Mom) | www.dnecontracting.com — site, funnel, estimator, portal; `plumbing_leads`, `dne`/`planner` data; first rx client when ready (`rx` row commented in seed) | `dne-contracting/` |
| Hubs & Babydoll | Square checkout + admin + SMS stack (`hb-*` edge functions, `hb_*` tables); lead form `/capture/?c=hubsandbabydoll` | `clients/hubsandbabydoll/`, `capture/` |
| Voomlux | hosted page `/voomlux/` + members via legacy `/rewards/?c=voomlux` | `voomlux/` |

## Parked (built, not selling — don't touch, don't delete)
- **Chalk** (bar games) — `chalk/`, `chalk_*` tables, edge fns `stripe-webhook`/`weekly-report`/`tracker`/`call-status`/`dashboard`/`ops`
- **Nick Byrd TV** — branch `nickbyrd-tv`, `nb_*` tables
- **Legacy rewards engine** — `/rewards/` + `/arcade/` + `loop-*.js` kept ONLY because Voomlux members use it. Retire when Voomlux does.

## Archived (dead — code in `archive/`, history in git)
- **Loop / The Barber Loop** (dropped Sep 28): `archive/loop/` (barbers, build, hq CRM, kit, loyalty, shop, admin…). thebarberloop.com now redirects to tbsol.net. Data still in Supabase: `loop_*`, `booking_*`, `reward_*`, `bj_*`, `vp_*`, `ambassador*`, `review_*`.
- **Old agency maze / TB Command / The Last Game**: `archive/agency/` (university, command, suite, content-studio, marketing-engine, learn, studio, productions, api crons…). Daily render/post crons **removed** from vercel.json. Data: `uni_*`, `tlg_*`, `dm_*`, `drip_*`, `studio*`, `posts`, `marketing*`.

## Decommission list (when you have a spare hour — not urgent, nothing breaks by waiting)
1. Supabase: export then drop `uni_*`, `tlg_*`, `dm_*`, `ambassador*` tables; delete edge fns `loop-checkout`, `loop-stripe-webhook`, `fix-marketing-engine`, `drip-*` (download source first — it only lives deployed).
2. Twilio: finish toll-free verification (answers in the Oct 4 chat), then fund account past trial.
3. Vapi: add billing before real volume; set `VAPI_WEBHOOK_SECRET` as a true env secret (currently in `rx_config`).
4. Let thebarberloop.com expire at renewal.

## Rules going forward
- **One prefix per product** in Supabase (`rx_`, `chalk_`, `hb_`, `nb_`, `dne/planner`). New product = new prefix, listed here.
- **New pages**: live products at root, everything else doesn't ship. Nothing new links into `archive/`.
- **This file is the map.** Ship something new → add it here in the same commit.
