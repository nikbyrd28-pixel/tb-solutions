# TB HQ — tbsol.net/hq/

Nick's one-screen CRM. Replaces the archived TB Command for what actually matters: every lead, from every table, with call/text buttons and a status dropdown, plus the receptionist backend.

- **Leads tab** — union of `intakes`, `lsa_leads`, `client_leads` (test clients filtered), `plumbing_leads` (DNE), and unhandled `rx_messages`. Status: new → contacted → audit_sent → quoted → won / lost. Notes save on blur.
- **Receptionist tab** — 30-day stats, booked `rx_jobs` (status editable), `rx_calls` with summaries + recordings.
- **RX Clients tab** — `rx_businesses`, owner + agent numbers.

Access: Supabase auth login; user must be in `hq_admins` (Nick is). Add another admin:
`insert into hq_admins(user_id) select id from auth.users where email='x@y.com';`

Backend: `supabase/001_hq.sql` — `is_hq_admin()`, `hq_pipeline(days)`, `hq_set_status(src,id,status,notes)`, `hq_rx(days)`, `hq_rx_job_status(id,status)`. All SECURITY DEFINER, all gated on `is_hq_admin()`; no table policies were widened.

Add to phone home screen: open tbsol.net/hq/ → Share → Add to Home Screen.
