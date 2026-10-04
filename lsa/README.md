# LSA Shield — TB Solutions

Offer built around Google's Oct 2026 Local Services Ads change: LSA folds into Google Ads (PMax pay-per-lead), old dashboard retires, manual bidding gone, history deleted unless exported, and **since Oct 1 missed calls (~20s hold) bill as leads**.

## The offer
| | LSA Shield | Migration only |
|---|---|---|
| Price | **$497 setup + $297/mo** (first 5 in Oct: $297 setup) | **$497 once** |
| Migration + history export | ✓ | ✓ |
| Campaign rebuilt in Google Ads (budget cap, area, hours, GBP match) | ✓ | ✓ |
| AI receptionist on LSA line (the `receptionist/` product) | ✓ | — |
| Weekly lead review + dispute filing | ✓ | — |
| Budget watch + Monday scorecard | ✓ | — |

Existing Never Miss a Call customers: Shield add-on is +$100/mo.
Guarantee: disputes won + jobs booked < monthly fee in first 60 days → month 3 free.

Why $297: receptionist is already $197/mo. +$100 for ~30 min/wk of dispute filing + budget watch. Hard cost per client ≈ $20–40/mo (Vapi/Twilio). Migration-only is pure margin, ~2 hrs of work.

## Backend
- `supabase/001_lsa_schema.sql` — `lsa_leads` table (RLS on, no anon policy; writes via function only).
- `supabase/functions/lsa-intake/index.ts` — `POST` JSON. `mode:"calc"` returns numbers only; `mode:"audit"` saves row, texts Nick (`NICK_PHONE` secret) and the shop, returns numbers. Deployed with `verify_jwt: false` (public form). Reuses the same Twilio secrets as `rx-agent`.
- `index.html` — tbsol.net/lsa/. Calculator math mirrors the function (missed calls × 60% billable × lead cost + missed × 35% × avg ticket).

Pipeline: `lsa_leads.status` = new → contacted → audit_sent → won → lost. Query newest:
`select created_at, business, name, phone, trade, lsa_status, monthly_spend, est_total_mo, status from lsa_leads order by created_at desc;`

## Delivery checklist (Shield client)
1. Audit call (10 min): get LSA login or add Nick as manager, confirm migration date from the email, pull lead cost + last-30-day lead list.
2. **Export everything** from the LSA dashboard before migration day (leads CSV, charges). Save to Drive under the client.
3. On/after migration: in Google Ads → the PMax pay-per-lead campaign → set budget cap, service area, job types, hours. Confirm GBP phone = LSA number.
4. Receptionist onboarding (receptionist/README.md "Adding a real client") → forward LSA line on no-answer.
5. Weekly (Mon): review leads charged, file disputes (spam, out of area, duplicate, solicitor, wrong service). Log results; scorecard text via n8n weekly report (extend `rx_weekly_report`).

## Cold call script (plumbers/HVAC/electrical running LSA)
> "Hey, is this [owner]? Nick, I'm local in Chester County. Quick one — did you get Google's email about Local Services Ads moving into Google Ads? ... Most guys haven't. Two things in it that hit your wallet: your old dashboard and lead history get deleted on your migration date, and since October 1st a missed call that rings 20 seconds counts as a paid lead. So every call that goes to voicemail is now a bill. I run a free 10-minute audit — I check your migration date, what you're paying per lead, and how many rang out last month. Want me to pull it up and text you the numbers?"

Objection — "I'll handle it": "Totally fine. Just export your lead history before your date, Google deletes it. If you want the export done and the budget cap set so the new auto-bidding doesn't creep, it's $497 once."
Objection — "I have someone on the phones": "Then I'm only talking about lunch, after five, Saturdays, and when she's on the other line — those are exactly the calls Google now charges you for."
Close: "Let's do the audit now — what's the email on the LSA account?"

## Where to find them
Search Google for "[trade] near [town]" — the Google Guaranteed / green-check block at the top is LSA advertisers. Every one of those is a prospect that is in the first migration wave. Pottstown, Phoenixville, West Chester, Exton, Downingtown, Royersford, Collegeville.

## Not done
- `NICK_PHONE` secret on Supabase (Nick's cell, E.164) so audit alerts text him. Until set, rows save silently.
- Twilio secrets (shared with receptionist) for texting.
- Weekly dispute scorecard automation (extend n8n `rx-weekly-report.json`).
