# Google Rank Fix, automated ($697 + $97/mo)

The 17-step playbook (`hq_playbook`) is what Nick sells. The `rank-audit` edge function runs the half
of it a machine can read, writes a one-line finding and a status onto each step of the client's project
(`hq_project_items`), and keeps the raw proof in `evidence` (HQ only). Human steps stay `todo` with a
private `next_step` note telling Nick what to do. The client watches `/audit/?t=<share_token>`.

Files: `hq/supabase/functions/rank-audit/{index.ts,checks.ts,deno.json,test/}`, `hq/supabase/014_rank_auto.sql`,
`hq/index.html` (Work tab), `audit/index.html`, `rank/index.html`.

## When it runs

| Trigger | How |
|---|---|
| HQ → Work → **+ New client** | after `hq_project_create`, HQ POSTs `{project_id}` to the function with the admin JWT |
| HQ → project → **Re-run audit** | same call; `hq_project_audit_run(uuid)` is the pg_net fallback from SQL |
| Monthly re-check | pg_cron `rank-audit-monthly`, daily 11:40 UTC, POSTs `{"mode":"monthly"}` with `x-rx-sync-secret`; `rank_audit_due()` returns up to 5 active/done projects not checked in 28 days, so each paying client is read once a month |

Auth: admin JWT (checked against `is_hq_admin()`) or `x-rx-sync-secret` = `RX_SYNC_SECRET`. Nothing else gets in.

## What the machine checks (automated)

Source of truth is `checks.ts`; the fixtures in `test/fixtures/` show a good page and a bad page.

| Step key | Pass / fail on |
|---|---|
| `site` | site loads, https, http → https redirect, redirect hops < 3, viewport tag, title (15+ chars), meta description, exactly one H1, `tel:` link, page weight (300 KB) and render-blocking head scripts (6) |
| `site_form` | a `<form>` or an embedded booking tool (Jobber, Housecall, Calendly, Jotform…) |
| `site_map` | LocalBusiness/Plumber/HVAC… JSON-LD (or microdata) and a Google Maps iframe |
| `site_index` | `/sitemap.xml` (real urlset), `/robots.txt`; `/llms.txt` is a note, not a fail |
| `reviews_count` | Google review count and rating vs the top 3 shops for the same trade + town; fail under 10 or under half the competitor average |
| `nap` | Google phone vs every phone on the site (tel links, text, schema), 3+ numbers on the site, street number in schema vs Google, other Google listings on the same phone (phone text search) |
| `nap_name` | Google name vs schema name / og:site_name / title |
| `address` | fail if Google shows an apartment/unit style address; pass if service-area business; otherwise manual with a question for Nick |
| `hours` | fail if no hours on Google; manual with the hours quoted if present |
| `gbp_about` | photos (< 3), website link, phone, hours, business status, from the Places record |
| `gbp_cat` | Google primary category words vs the site title/H1 |

Also written: `hq_projects.place_id`, `audited_at`, `audit_summary` (place, reviews, competitors, duplicate count), `audit_error`.

## What stays manual (todo with a prefilled note for Nick)

`logo`, `reviews_camp` (needs the customer list), `reviews_reply` (Google does not expose owner replies),
`apple` (no free Apple Maps lookup; businessconnect.apple.com), `trust` (BBB/Chamber by hand; the site's
own trust links are noted), `gbp_heat` (Local Falcon before/after), plus the About text, services and
attributes on the profile (owner login). Yelp, Facebook, BBB listings are not read: only Google and the site.

## What a run does to a step (`rank_audit_apply`)

- **pass** → `done`, unless Nick already set done/na. Finding written only if the line was empty or machine-written.
- **fail** → `todo` (doing stays doing, na stays na), finding + private `next_step`. If the step was `done`, it is a
  **regression**: `regressed = true`, the stale finding is replaced, and `next_step` starts with
  "Slipped since the last check (Mon DD)". HQ shows it red, the list shows "N slipped".
- **manual** → status untouched; hint into `next_step`, finding only if the box was empty.
- Nick typing a finding sets `auto = false` so the machine never overwrites it. Tapping the status box clears `regressed`.

Client page (`audit_public`) gained `audited_at` and per-item `checked_at` only. Still no phone, email,
notes, evidence, next_step or business_id. It stays the only anon-executable function; the new ones are
service_role only (`rank_audit_apply`, `rank_audit_due`) or authenticated + admin check (`hq_project_audit_run`).

## Deploy

```sh
# 1. SQL: paste hq/supabase/014_rank_auto.sql into the Supabase SQL editor (after 013; safe to re-run)
# 2. function (JWT verification on: the cron path sends the shared secret in the body header, not a JWT,
#    so deploy with --no-verify-jwt and let the function do its own auth, same as rx-review-engine)
supabase functions deploy rank-audit --project-ref qgbjiqdwzgkjkmqyjsmc --no-verify-jwt
# 3. nothing to set if Finder already works: GOOGLE_PLACES_KEY and RX_SYNC_SECRET are read from rx_config
```

Cron is scheduled by the SQL itself. To run the monthly pass by hand:

```sql
select net.http_post(
  url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rank-audit',
  headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret',(select value from rx_config where key='RX_SYNC_SECRET')),
  body := '{"mode":"monthly"}'::jsonb);
```

## Tests

```sh
cd hq/supabase/functions/rank-audit
deno check index.ts checks.ts
deno test --allow-read test/      # 11 fixture tests: good page, bad page, no site, site down, not on Google, regression, wording rule
```

014 was run twice on a scratch Postgres with 013's dependencies stubbed (roles, `is_hq_admin`, `rx_config`,
`rx_businesses`, `cron`, `net`) and the apply/regress/due/grant paths exercised by hand.
