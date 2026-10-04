# TB Solutions AI Receptionist (`rx`)

One Supabase edge function serves every client, and every client can run **as many AI phone agents as they want** — a main line, a booking line, an after-hours emergency line, a support line. One number per agent. Vapi does the voice; we own the brain, the data, and the texts.

```
caller → the number they dialed → Vapi (assistant-request) → rx-agent looks up THAT agent
       → returns that agent's prompt + tools + voice (role decides what it can do)
       → during call: check_availability / book_job / take_message / out_of_area / transfer_call
       → rows in rx_* tables, stamped with agent_id so you can see which line earned what
       → book_job texts the customer a confirmation and that line's notify phone the job details
       → end-of-call-report → rx_calls row (summary, transcript, recording) → text for anything unbooked
```

## Files
- `supabase/001_rx_schema.sql` — tables (`rx_businesses`, `rx_services`, `rx_on_call`, `rx_calls`, `rx_jobs`, `rx_messages`), RLS on, owner-dashboard policies ready.
- `supabase/002_rx_seed_demo.sql` — "Keystone Plumbing" demo business with 9 services + safety steps. The public demo line.
- `supabase/003_rx_agents.sql` — **`rx_agents`**: many lines per business, `agent_id` on calls/jobs/messages, and the `rx_agent_stats` per-line scoreboard. Backfills every existing business into one `main` agent, so nothing changes until you add a second line.
- `supabase/004_rx_seed_demo_agents.sql` — four extra demo lines (booking, after-hours, support, estimates) so you can hear the roles side by side.
- `supabase/functions/rx-agent/index.ts` — the webhook. Deploy with `verify_jwt: false` (authed by `x-vapi-secret`).
- `vapi/provision.mjs` — creates one Vapi phone number per agent, pointed at the webhook. Re-runs are safe.
- `test/simulate.mjs` — fakes a full call against any line (`RX_AGENT=after-hours`).

## Agents (lines)
Each `rx_agents` row is one phone number with its own personality and job. Anything you leave null falls back to the business row, so a one-line client needs no agent config at all.

| Column | What it does |
| --- | --- |
| `slug`, `label` | `main`, `booking`, `after-hours`… and the internal name you'll see in texts |
| `role` | what the line is FOR — picks the mission, greeting and tool set (below) |
| `agent_name` | the persona the caller hears ("this is Marcus") |
| `phone_number` | the number that routes here. **This is how the agent is resolved.** |
| `greeting`, `prompt_extra` | override the first message; bolt extra instructions onto this line only |
| `tools_allow` | narrow the role's tools further (never widens them) |
| `voice`, `model` | per-line voice/model override — a different voice per line sells it |
| `hours`, `windows`, `jobs_per_window` | per-line overrides; a 24/7 emergency line sets its own hours |
| `emergency_policy`, `transfer_number` | per-line escalation |
| `notify_phone` | **who gets this line's texts** — send support to the office, emergencies to the on-call cell |
| `priority` | lowest active priority is the business's default line |

### Roles
| Role | Can call | Behaves like |
| --- | --- | --- |
| `receptionist` | availability, book, message, out-of-area | the original all-rounder: triage, safety step, book |
| `booking` | same | assumes the caller wants an appointment; anything else → message |
| `emergency` | availability, book, message, **transfer** | after-hours triage: safety step, then transfer or same-night dispatch |
| `support` | **message only** | existing customers, invoices, warranty, complaints. Never books, never quotes. |
| `estimates` | availability, book, message, out-of-area | replacements and remodels, books free estimate visits, never gives a number |
| `overflow` | same as receptionist | the rollover line when the main one is busy |

Capacity is counted **across the whole business**, not per line — every agent books the same crew, so two lines can never sell the same truck twice.

## Go-live (≈20 min, in order)
1. **Supabase → SQL editor:** run `001`, `002`, `003`, then `004` (change `+16105550100` to your cell in `002` first — that's who gets the texts).
2. **Supabase → Edge Functions → Secrets:** `VAPI_WEBHOOK_SECRET` (any long random string), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Deploy `rx-agent` (CLI: `supabase functions deploy rx-agent --no-verify-jwt`).
3. **Vapi:** sign up at dashboard.vapi.ai, grab the private API key, then provision a number per line:
   ```
   VAPI_API_KEY=… VAPI_WEBHOOK_SECRET=… AREA_CODE=610 \
   RX_WEBHOOK_URL=https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent \
   node receptionist/vapi/provision.mjs demo main after-hours support
   ```
   Bringing your own Twilio numbers: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_NUMBERS=+1610…,+1610…` (handed out in the order you list the agents).
4. Paste the `update public.rx_agents set phone_number = …` statements it prints.
5. Call them. Say "my water heater is leaking" on the main line, then the same thing on the after-hours line and hear the difference.

Test without dialing:
```
RX_WEBHOOK_URL=… VAPI_WEBHOOK_SECRET=… RX_SLUG=demo RX_AGENT=support node receptionist/test/simulate.mjs
```

## Adding a real client
Insert an `rx_businesses` row (`slug`, `name`, `owner_phone`, fees, `service_area_note`, `knowledge`) and their `rx_services` (copy the demo ones). Insert one `rx_agents` row per line you're selling them, provision the numbers, set `phone_number`. Have them forward their business line to the main number on no-answer (`*72` style carrier forwarding or in their phone system), and point their after-hours forwarding at the emergency line. The prompt is generated from the rows — no per-client prompt editing.

A one-line client is still the default: give them a single `main` agent and it behaves exactly like the original single-number setup. `rx_businesses.agent_number` / `agent_name` stay as a fallback for anything not migrated yet.

## Costs (rough)
Vapi ≈ $0.05–0.13/min all-in (model+voice+transcription), Twilio number $1.15/mo + ~$0.008/SMS. Extra lines cost ~$1.15/mo each until they actually ring — the airtime is what you pay for, not the agent. A shop doing 150 calls × 2 min ≈ $20–40/mo in hard cost against a $300–500/mo price; splitting those calls across four lines costs the same minutes.

## Not built yet (next)
- Owner dashboard page (`/receptionist/owner/`) reading `rx_jobs` + `rx_calls` + `rx_agent_stats` via the RLS policies already in place.
- Jobber / Housecall Pro push (write `external_ref` on `rx_jobs`).
- Missed-call text-back when the caller hangs up before the agent answers (Vapi `status-update` → `sms`).
- Rollover: point the `overflow` role at a Twilio hunt group so a busy main line hands off instead of ringing out.
