-- Site lead form: separate "18 or older + terms" box (applied via MCP 2026-10-10).
alter table public.intakes
  add column if not exists age_terms      boolean,
  add column if not exists age_terms_at   timestamptz,
  add column if not exists age_terms_text text;
