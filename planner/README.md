# Remodel Planner ($697 build + $67/mo) — delivery

One planner app, one row per plumber. Sales page: `planner/index.html` (tbsol.net/planner/).
The product: `planner/app/` at **tbsol.net/planner/app/?c=<slug>**. Nothing on a client's page says
D N E or TB Solutions except the "Built by TB Solutions" footer line.

## Pieces
| Piece | Where |
|---|---|
| Tenant app (brand, project types, scopes, estimate, timeline, budget, contact, photo/plan upload) | `planner/app/index.html` |
| Tables `planner_clients` (config) and `planner_leads`, private bucket `planner-uploads` | `planner/supabase/001_planner_clients.sql` |
| Anon RPCs `planner_config(slug, host)` and `planner_lead_submit(jsonb)` (the only insert path; checks slug is active, recomputes estimate + score) | same file |
| HQ RPCs `hq_planner()`, `hq_planner_leads(client, days)`, `hq_planner_client_create(jsonb)`, `hq_planner_client_save(id, jsonb)`, `hq_planner_lead_set(id, status, notes)` (SECURITY DEFINER, `is_hq_admin()` gate, no anon grant) | same file |
| Edge fn `planner-intake`: saves via the RPC, stores files, texts + emails the owner, texts Nick on a shop's first lead | `planner/supabase/functions/planner-intake/index.ts` |
| HQ → Planner tab: tenant list, + New client, edit config, copy link / embed, leads list with status | `hq/index.html` |

D N E Contracting is seeded as slug `dne` with the real values from `dne-contracting/index.html`
(phone, email, license, service area, Nicole, red #B8322B). dnecontracting.com is untouched; compare
side by side at tbsol.net/planner/app/?c=dne.

## One-time setup (Nick)
1. Supabase SQL editor: run `planner/supabase/001_planner_clients.sql` (safe to re-run).
2. Deploy the function: `supabase functions deploy planner-intake --no-verify-jwt` from a folder that
   contains `supabase/functions/planner-intake/` (copy `planner/supabase/functions/planner-intake` there, or
   paste it into the dashboard).
3. Secrets (already set for site-intake): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (or `TWILIO_API_KEY`/`TWILIO_API_SECRET`),
   `TWILIO_FROM`, `NICK_PHONE`. New for email: `RESEND_API_KEY` and `PLANNER_FROM_EMAIL`
   (e.g. `Remodel Planner <planner@tbsol.net>`, domain verified in Resend). Without Resend, leads still save and text; email is skipped and logged.
4. Push `main`; Vercel serves `/planner/app/`.

## Turning a plumber on (per sale, 2 minutes)
1. HQ → Planner → **+ New client**: business name, shop phone, owner cell, owner email, service area.
   Creates the row with D N E's project types, price ranges and intake words copied in.
2. Open it: set brand color (hex), logo URL (optional), license line, website link; fix the price ranges
   with the owner on the phone (they approve the "usually runs" numbers); Save.
3. **Copy link** and text it to them, or **Copy embed** (an iframe) for their site, or add it to their
   Google Business Profile as the booking/quote link. Flip **Planner is live** off to pause.
4. First lead texts Nick once (NICK_PHONE). Every lead texts the owner cell and emails the owner email.
   Leads live in HQ → Planner (status new → contacted → booked → quoted → won/lost; files open via signed URL).

## Config fields (`planner_clients`)
| Field | What |
|---|---|
| `slug` | in the link; lowercase, letters/digits/dashes |
| `business_name`, `owner_name`, `phone`, `email`, `license`, `website_url`, `service_area` | shown on the page / footer |
| `logo_url`, `primary_color` | header logo (blank = initials block), brand hex used on buttons, bars, estimate |
| `services` | `[{key,label,blurb,time,scopes:[{key,label,low,high}]}]`; estimate = picked scope's low..high |
| `intake` | `headline, intro, submit_label, thanks, show_estimate, allow_upload, ask_town, ask_zip, timelines[], budgets[], autoreply` (merged over `planner_default_intake()`) |
| `notify_phone`, `notify_email` | where the lead goes (never sent to the browser) |
| `hostnames` | custom domains that resolve to this tenant (see below) |
| `owner_user_id` | Supabase auth user who may `select` their own `planner_clients` / `planner_leads` rows and read their uploads (owner app to come; set in SQL for now) |
| `active` | off = page shows "not live", RPC refuses inserts |

Lead payload the app posts (JSON, or multipart with `payload` + `files` when photos are attached):
`slug, name, phone, email, town, zip, project_type, project_label, scope, scope_label, timeline, budget, budget_label, notes, contact_pref, sms_consent, answers, source_url, utm`.

## Custom domains (planner.keystoneplumbing.com)
The app already resolves the tenant three ways, in order: `?c=slug`, `<html data-client="slug">`, then the
hostname against `planner_clients.hostnames` (www. stripped). To put a planner on a shop's own domain:
1. HQ → Planner → client → Brand → Custom domains: add `planner.keystoneplumbing.com`.
2. Shop adds a CNAME `planner` → `cname.vercel-dns.com`.
3. Add the domain to the Vercel project `tb-solutions`, and add a rewrite in `vercel.json`:
   `{ "source": "/", "has": [{ "type": "host", "value": "planner.keystoneplumbing.com" }], "destination": "/planner/app/index.html" }`
   (one rule per domain; a later pass can replace this with a single catch-all rule for every host that is not tbsol.net).
Or, with no DNS at all: the shop pastes `<div data-client="keystone-plumbing">` + the iframe embed from HQ on any page of their site.

## Tested (Oct 13 2026)
- SQL run twice on a scratch Postgres 16 with `auth`/`storage`/roles/`hq_admins` stubbed: idempotent; anon can read config and submit but cannot read tables or call `hq_*`; non-admin gets null; owner sees only own rows; host lookup works.
- `deno check` on the edge function: clean.
- Playwright at 390 and 1280 with `planner_config` and `planner-intake` mocked: full flow, estimate shows, payload correct (JSON and multipart), no console errors, no horizontal overflow.
- HQ Planner tab rendered with mocked RPCs: list, edit, leads, no errors.
Not run against the live project: nothing was applied or deployed.
