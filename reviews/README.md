# Review Engine — how the $97/mo offer gets delivered

tbsol.net/reviews/ sells it. This folder is what makes it real with no hands on it.

## What happens

1. **A job is marked done.** Four doors, all land in `rx_review_requests`:
   - receptionist job → `rx_jobs.status` becomes `done` (HQ) or `completed` (owner app). Trigger `rx_jobs_review` enqueues it.
   - owner app → Reviews tab → **Job done** (name + cell), or paste a list / CSV. RPCs `rx_owner_review_request`, `rx_owner_review_import`.
   - HQ → Reviews → **+ Job done** on the client's card. RPC `hq_review_request`.
   - Housecall Pro / Jobber / Zapier → POST `…/functions/v1/rx-review-io/hook/<token>` with the job json. Token per shop (`rx_businesses.review_hook_token`, **Hook URL** button in HQ copies it).
2. **Two hours later**, edge fn `rx-review-engine` (pg_cron every 10 min) texts the customer one message with the shop's Google review link. The link is `tbsol.net/r/<token>` so the tap is counted (Vercel rewrites `/r/*` to `rx-review-io/r/*`, which 302s to Google).
3. **Day 3, no tap** → one reminder. That's the second and last text. Tap at any point ends the sequence.
4. **STOP** at any point (reply to the shop's number, or Twilio error 21610) → `rx_sms_optins` gets a `service_texts=false` row, every open request for that number flips to `stopped`, and `rx_review_enqueue` refuses the number forever. Same ledger `rx-agent` and `rx-review` already read, so a STOP here stops booking texts too, and vice versa.
5. **Fridays 9:05pm UTC** each owner gets one text: asked, tapped, Google count + rating. **Daily 11:20 UTC** the Google rating/count is snapshotted per shop (needs a Place ID + `GOOGLE_PLACES_KEY`); when the count goes up, the oldest recent taps are credited as `reviewed`.

Quiet hours: nothing goes out before 9am or after 8pm in the shop's timezone; it waits for 9am.

Who gets texted: a number is texted only if the latest `rx_sms_optins` row says yes, **or** there is no row at all and the source attested consent (receptionist `[sms consent: yes]`, the owner's own button/import, a field-app webhook). No consent, no text; the row is logged `skipped` with the reason.

## Turn it on for a client

HQ → Reviews → the client's card → paste the Google review link (Business Profile → Ask for reviews) or the Place ID → **Turn on**. That's it.

Same thing in SQL:

```sql
update rx_businesses set review_engine = true, google_place_id = 'ChIJ…' where slug = 'their-slug';
```

Owners can set their own link / Place ID in their app (Reviews tab); only you can flip `review_engine`.

Clients without the receptionist: create the `rx_businesses` row the usual way (`receptionist/supabase/new_client_template.sql`, no agent number needed), invite the owner (`hq_rx_invite`), turn the engine on. They use the Job done button / paste box, or you paste the Hook URL into Housecall Pro (Settings → API → webhooks, event `job.completed`) or Jobber/Zapier.

## Files

| File | What |
|---|---|
| `supabase/001_rx_review_engine.sql` | tables `rx_review_requests`, `rx_review_snapshots`, view `rx_review_weekly`; columns `rx_businesses.google_place_id / review_engine / review_hook_token`; trigger `rx_jobs_review`; RPCs; RLS; grants; three pg_cron jobs. Idempotent. |
| `supabase/functions/rx-review-engine/index.ts` | sender (`{"mode":"send"}`), snapshot (`"snapshot"`), Friday digest (`"weekly"`). Auth `x-rx-sync-secret`. |
| `supabase/functions/rx-review-io/index.ts` | `GET /r/<token>` redirect, `POST /sms` Twilio inbound (STOP/START/HELP + forward replies to the owner), `POST /hook/<token>`. Deploy `--no-verify-jwt`. |
| `test/ui.spec.mjs` | Playwright: owner app + HQ Reviews tabs at 390px, RPCs mocked, fails on console errors or overflow. |
| `../vercel.json` | rewrite `/r/:token` → `rx-review-io/r/:token` |
| `../receptionist/app/index.html` | Reviews tab (`rx_owner_reviews`, `rx_owner_review_request`, `rx_owner_review_import`, `rx_owner_review_settings`, `rx_owner_review_action`) |
| `../hq/index.html` | Reviews tab (`hq_reviews`, `hq_review_settings`, `hq_review_request`, `hq_review_action`) + a Reviews line on each RX Clients card |

RPC surface: owner `rx_owner_*` (auth.uid → their business only), HQ `hq_*` (`is_hq_admin()`), service-role only: `rx_review_enqueue`, `rx_review_due`, `rx_review_mark`, `rx_review_click`, `rx_review_inbound`, `rx_review_hook`, `rx_review_snapshot_save`, `rx_review_weekly_digest`, `rx_review_summary`. Nothing new is executable by `anon`; the migration also revokes PUBLIC from the older `hq_review_asks` / `rx_owner_review_url`.

## Deploy (once)

```sh
# 1. SQL — paste reviews/supabase/001_rx_review_engine.sql into the Supabase SQL editor (safe to re-run)
# 2. functions
supabase functions deploy rx-review-engine --project-ref qgbjiqdwzgkjkmqyjsmc
supabase functions deploy rx-review-io     --project-ref qgbjiqdwzgkjkmqyjsmc --no-verify-jwt
# 3. Twilio console → the TWILIO_FROM number → Messaging → "A message comes in" →
#    https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-review-io/sms   (HTTP POST)
# 4. push vercel.json (the /r/ rewrite) — happens with the normal deploy
```

The migration schedules the three cron jobs itself and unschedules the old `rx-review-hourly` (every shop that had a `review_url` is backfilled to `review_engine = true`, so leaving both on would double-text). If you ever want the old one back, re-run the cron block at the bottom of `hq/supabase/006_hq_agents.sql`.

## Secrets / config it reads

All already in `rx_config` except the last two. Env vars override `rx_config`.

| Key | Used for | Status |
|---|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_FROM` | sending | set |
| `RX_SYNC_SECRET` | pg_cron → edge fn auth; also `?s=` fallback on `/sms` | set |
| `TWILIO_AUTH_TOKEN` | verifying `X-Twilio-Signature` on `/sms` (preferred) | **add** (or append `?s=<RX_SYNC_SECRET>` to the webhook URL in Twilio) |
| `GOOGLE_PLACES_KEY` | daily rating/count snapshot | set if Finder is set up; otherwise counts stay blank, everything else works |
| `REVIEW_LINK_BASE` | optional, default `https://tbsol.net/r/` | optional |
| `REVIEW_SMS_WEBHOOK_URL` | optional, only if the Twilio webhook URL differs from the default (signature is computed over the exact URL) | optional |

Twilio trial: texts only reach verified numbers until the toll-free verification finishes (ECOSYSTEM decommission list #2).

## Checking it

- `select * from rx_review_requests order by created_at desc limit 20;`
- `select * from rx_review_weekly where business_id = '…';`
- `select jobname, schedule, active from cron.job where jobname like 'rx-review%';`
- Edge logs: `rx-review-engine` returns `{due, sent, deferred, skipped, stopped, failed}` every run.
- UI: `cd` repo root, `npm i playwright` somewhere on the path, `npx playwright install chromium`, `node reviews/test/ui.spec.mjs`.
