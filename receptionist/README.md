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

## Go-live (≈20 min, in order)
1. **Supabase → SQL editor:** run `001_rx_schema.sql`, then `002_rx_seed_demo.sql` (change `+16105550100` to your cell first — that's who gets the texts).
2. **Supabase → Edge Functions → Secrets:** `VAPI_WEBHOOK_SECRET` (any long random string), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Deploy `rx-agent` (CLI: `supabase functions deploy rx-agent --no-verify-jwt`).
3. **Vapi:** sign up at dashboard.vapi.ai, grab the private API key, then
   `VAPI_API_KEY=… VAPI_WEBHOOK_SECRET=… RX_WEBHOOK_URL=https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent AREA_CODE=610 node receptionist/vapi/provision.mjs`
4. `update rx_businesses set agent_number='<the number it printed>' where slug='demo';`
5. Call it. Say "my water heater is leaking." You should get two texts.

## Adding a real client (your mom first)
Insert an `rx_businesses` row (`slug`, `name`, `owner_phone`, fees, `service_area_note`, `knowledge`) and their `rx_services` (copy the demo ones). Run `provision.mjs` again with their Twilio number, set `agent_number`. Have them forward their business line to it on no-answer (`*72` style carrier forwarding or in their phone system). That's the whole onboarding — the prompt is generated from the row, no per-client prompt editing.

## Costs (rough, per client)
Vapi ≈ $0.05–0.13/min all-in (model+voice+transcription), Twilio number $1.15/mo + ~$0.008/SMS. A shop doing 150 calls × 2 min ≈ $20–40/mo in hard cost against a $300–500/mo price.

## Not built yet (next)
- Owner dashboard page (`/receptionist/owner/`) reading `rx_jobs` + `rx_calls` via the RLS policies already in place.
- Jobber / Housecall Pro push (write `external_ref` on `rx_jobs`).
- Missed-call text-back when the caller hangs up before the agent answers (Vapi `status-update` → `sms`).
