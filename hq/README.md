# TB HQ — tbsol.net/hq/

Nick's one-screen CRM. Replaces the archived TB Command for what actually matters: every lead, from every table, with call/text buttons and a status dropdown, plus the receptionist backend.

- **Leads tab** — union of `intakes`, `lsa_leads`, `client_leads` (test clients filtered), `plumbing_leads` (DNE), and unhandled `rx_messages`. Status: new → contacted → audit_sent → quoted → won / lost. Notes save on blur.
- **Receptionist tab** — 30-day stats, booked `rx_jobs` (status editable), `rx_calls` with summaries + recordings.
- **RX Clients tab** — every receptionist line. **Edit brain**: company, owner cell, receptionist name, fees, zips/area, hours, arrival windows, emergency policy, free-text knowledge, and the bookable services (keywords, urgency, fee override, safety steps). Saves to `rx_businesses`/`rx_services`; `rx-agent` builds the prompt from those rows on every call, so edits are live on the next call. **+ New client line** creates the row (inactive, demo services copied) — then run `provision.mjs` for the number and flip Line active.

Access: Supabase auth login; user must be in `hq_admins` (Nick is). Add another admin:
`insert into hq_admins(user_id) select id from auth.users where email='x@y.com';`

Backend: `supabase/001_hq.sql` + `supabase/002_hq_rx_editor.sql` (`hq_rx_business`, `hq_rx_business_save`, `hq_rx_service_save`, `hq_rx_business_create`) — `is_hq_admin()`, `hq_pipeline(days)`, `hq_set_status(src,id,status,notes)`, `hq_rx(days)`, `hq_rx_job_status(id,status)`. All SECURITY DEFINER, all gated on `is_hq_admin()`; no table policies were widened.

Add to phone home screen: open tbsol.net/hq/ → Share → Add to Home Screen.
