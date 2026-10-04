# TB Solutions AI Receptionist (`rx`)

One Supabase edge function + one phone number per client. Vapi does the voice; we own the brain, the data, and the texts.

```
caller → Twilio/Vapi number → Vapi (assistant-request) → rx-agent returns prompt+tools for THAT business
       → during call: check_availability / book_job / take_message / out_of_area → rows in rx_* tables
       → book_job texts the customer a confirmation and the owner the job details (Twilio)
       → end-of-call-report → rx_calls row (summary, transcript, recording) → owner texted for anything unbooked
```

## Files
- `supabase/001_rx_schema.sql` — tables (`rx_businesses`, `rx_services`, `rx_on_call`, `rx_calls`, `rx_jobs`, `rx_messages`), RLS on, owner-dashboard policies ready.
- `supabase/002_rx_seed_demo.sql` — "Keystone Plumbing" demo business with 9 services + safety steps. The public demo line.
- `supabase/functions/rx-agent/index.ts` — the webhook. Deploy with `verify_jwt: false` (authed by `x-vapi-secret`).
- `vapi/provision.mjs` — creates the Vapi phone number pointed at the webhook (imports your Twilio number, or buys a free Vapi number).
- `test/simulate.mjs` — fakes a full call (assistant-request → availability → booking → end report) against the live function.

## Status (Oct 4 2026)
DONE: rx_* tables + RLS + Keystone Plumbing demo seeded on Supabase "Base"; `rx-agent` deployed (verify_jwt off); end-to-end simulate.mjs passes (assistant-request → availability → book_job → end-of-call); missed-call text-back added; `rx_weekly_report()` + `n8n/rx-weekly-report.json`; sales page live at tbsol.net/receptionist/.
NOT DONE (needs Nick's accounts): Vapi key + phone number (provision.mjs), Twilio creds as edge-function secrets, VAPI_WEBHOOK_SECRET, owner_phone on the demo row, DEMO_NUMBER/NICK_NUMBER in index.html.

## Go-live (≈20 min, in order)
1. **Supabase → SQL editor:** schema + demo are already applied. Just point the demo at your cell: `update rx_businesses set owner_phone='+1YOURCELL' where slug='demo'; update rx_on_call set phone='+1YOURCELL';`
2. **Supabase → Edge Functions → Secrets:** `VAPI_WEBHOOK_SECRET` (any long random string), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. `rx-agent` is already deployed; redeploy only after code changes (`supabase functions deploy rx-agent --no-verify-jwt`). Until VAPI_WEBHOOK_SECRET is set the function accepts unauthenticated posts — set it before giving the number out.
3. **Vapi:** sign up at dashboard.vapi.ai, grab the private API key, then
   `VAPI_API_KEY=… VAPI_WEBHOOK_SECRET=… RX_WEBHOOK_URL=https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent AREA_CODE=610 node receptionist/vapi/provision.mjs`
4. `update rx_businesses set agent_number='<the number it printed>' where slug='demo';`
5. Call it. Say "my water heater is leaking." You should get two texts.

## Adding a real client
Use `supabase/new_client_template.sql` (fill the brackets from the onboarding form), then:
Insert an `rx_businesses` row (`slug`, `name`, `owner_phone`, fees, `service_area_note`, `knowledge`) and their `rx_services` (copy the demo ones). Run `provision.mjs` again with their Twilio number, set `agent_number`. Have them forward their business line to it on no-answer (`*72` style carrier forwarding or in their phone system). That's the whole onboarding — the prompt is generated from the row, no per-client prompt editing.

## Costs (rough, per client)
Vapi ≈ $0.05–0.13/min all-in (model+voice+transcription), Twilio number $1.15/mo + ~$0.008/SMS. A shop doing 150 calls × 2 min ≈ $20–40/mo in hard cost against a $300–500/mo price.

## Not built yet (next)
- Owner dashboard page (`/receptionist/owner/`) reading `rx_jobs` + `rx_calls` via the RLS policies already in place.
- Jobber push (Housecall Pro is DONE: `rx-sync` edge fn + `rx_integrations` table + pg_net trigger on `rx_jobs` insert; key entered in HQ → Edit brain → Sends booked jobs to. Field names follow HCP public API docs — verify against the first client's real key; errors land in `rx_sync_log`).

## Integrations
- `supabase/004_rx_integrations.sql` + `supabase/functions/rx-sync/` — Housecall Pro job push (per-business API key, set in HQ).
