# TB Solutions — Ecosystem Map
*The one source of truth for what exists, where it lives, and whether it's alive. Updated Oct 4, 2026.*

## The business (what we sell)
**TB Solutions = the front office for the trades** (plumbers, HVAC, electricians). One hub, four offers, one bundle:

| Offer | Price | Funnel | Status |
|---|---|---|---|
| Never Miss a Call (AI receptionist) | $497 setup ($297 founding) + $197/mo | tbsol.net/receptionist/ | **LIVE** — demo (610) 998-6138 |
| Job-Ready Website | $497 build + $47/mo care | tbsol.net/websites/ | LIVE (selling) |
| Review Engine | $97/mo, no setup | tbsol.net/reviews/ | LIVE (selling; delivery = n8n flow, build on first sale) |
| Remodel Planner (blueprint-to-quote funnel) | $697 build + $67/mo, or $297 added to a website | tbsol.net/planner/ | LIVE (selling; delivery = DNE planner templatized, de-brand on first sale) |
| Full Front Office (all three) | $797 setup + $297/mo | hub | LIVE (selling) |

## Live stack
| Piece | What | Where |
|---|---|---|
| Hosting | Vercel project `tb-solutions` → tbsol.net (auto-deploys `main`) | this repo |
| Database | Supabase **"Base"** `qgbjiqdwzgkjkmqyjsmc` | — |
| Receptionist brain | edge function `rx-agent` (Vapi webhook: persona, booking, SMS) | `receptionist/supabase/functions/rx-agent/` |
| SMS consent intake | edge function `rx-optin` + `/receptionist/sms-consent/` page | `receptionist/` |
| Receptionist data | tables `rx_*` (businesses, services, jobs, calls, messages, optins, config) | Supabase |
| Secrets | `rx_config` table (Twilio keys, Vapi webhook secret) — env vars override | Supabase |
| Voice | Vapi — number (610) 998-6138 → rx-agent; provision new clients with `receptionist/vapi/provision.mjs` | dashboard.vapi.ai |
| SMS | Twilio — toll-free (833) 736-5726 (verification pending); trial = verified numbers only | console.twilio.com |
| Automation | self-hosted n8n — import `n8n/rx-weekly-report.json` (Mon 7am scorecard) | `n8n/` |
| Analytics | `track.js` → `track-visitor` edge fn → `visitors`/`pageviews` | root |
| Onboarding | `receptionist/supabase/new_client_template.sql` — 20-min new client | — |

## Clients (keep working, bill monthly)
| Client | What they have | Where |
|---|---|---|
| D N E Contracting (Mom) | dnecontracting.com — site, funnel, estimator, portal; `plumbing_leads`, `dne`/`planner` data; first rx client when ready (`rx` row commented in seed) | `dne-contracting/` |
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
