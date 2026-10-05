-- ============================================================
-- TB Command — n8n automation unlock
-- Run once: Supabase → SQL Editor → New query → paste ALL → Run
-- Lets the n8n "CRM Autopilot" workflow write website leads into
-- the leads table, and lets the admin see/manage those rows.
-- ============================================================

-- n8n inserts (via service key) have no logged-in user, so allow null owner.
alter table public.leads alter column user_id drop not null;

-- Admin sees and manages every lead, including automation-created ones.
drop policy if exists "admin full access leads" on public.leads;
create policy "admin full access leads" on public.leads
  for all to authenticated
  using ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com')
  with check ((auth.jwt()->>'email') = 'nikbyrd28@gmail.com');
