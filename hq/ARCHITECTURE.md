# TB Solutions — Agency OS Architecture & Roadmap

An honest architect's plan for turning tbsol.net into the operating system for
your AI marketing agency — built to serve hundreds of clients without
over-engineering or burning money on infrastructure you don't need yet.

## The core decision (and why)

You asked for a full custom Next.js + Prisma + Stripe + Resend rebuild. As a
straight recommendation: **don't build most of that from scratch.** For a solo
agency getting its first clients, the highest-reliability, lowest-cost path is
to lean on managed services that already solve auth, database, security,
storage, payments, and email — and glue them with n8n.

| Need | Don't build | Use (managed, production-grade) |
|------|-------------|--------------------------------|
| Auth + roles (Admin/Team/Client) | Custom JWT/session code | **Supabase Auth** + Row Level Security |
| Database | Self-hosted Postgres + Prisma migrations | **Supabase Postgres** (RLS = security per row) |
| File uploads (contracts, assets) | S3 plumbing | **Supabase Storage** |
| Payments / invoices | Custom Stripe integration | **Stripe Payment Links / Invoices** (no server code) |
| Contracts / e-sign | Custom signing flow | **Documenso / PandaDoc link** (or Stripe + checkbox) |
| Email automation | Custom cron + templates | **n8n + Resend** (you already run n8n) |
| Scheduling / Google Meet | Custom calendar | **Google Calendar appointment page** (already live) |
| Hosting / CI/CD | Manual | **Vercel + GitHub** (already live) |

This *is* a production, scalable stack. Supabase RLS + Stripe + n8n comfortably
handles hundreds of clients. A bespoke Next.js/Prisma monorepo becomes worth it
only when you have real scale and a team — Phase 4 below.

## Current state (live today)

```
tbsol.net/            Marketing site (static, Vercel) → leads → n8n + email
tbsol.net/hq          Command Center: Dashboard, My Tools, Leads (kanban),
                      Clients, Tasks, Marketing tools, Backup
                      Auth: Supabase email/password. Data: Supabase (kv table, RLS)
tbsol.net/start       Client intake form → n8n (type=client-intake) + email
tbsol.net/support     Support/ticket form → n8n (type=support-ticket) + email
n8n (Hostinger)       Automation hub — receives every form via webhook
```

## Data model (target, in Supabase)

Replace the single `kv` blob with real tables as you grow. Suggested schema:

```sql
-- profiles: one row per auth user, carries the role
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text,
  role text not null default 'client' check (role in ('admin','team','client')),
  created_at timestamptz default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users(id),          -- the agency owner (you)
  business text, contact_name text, email text, phone text,
  status text default 'onboarding', value numeric, notes text,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users(id),
  name text, business text, phone text, email text,
  stage text default 'New', source text, followup date, notes text,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  title text, status text default 'planning', due date, notes text
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  type text, priority text default 'normal', status text default 'new',
  subject text, details text, attachment_url text,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  amount numeric, status text default 'draft',   -- draft|sent|paid
  stripe_link text, due date, created_at timestamptz default now()
);

create table files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  name text, storage_path text, uploaded_at timestamptz default now()
);
```

**Security (RLS) — the core rule:** every table gets policies so a `client`
can only see rows where `client_id` maps to them, `team` sees assigned rows,
and `admin` (you) sees everything. This is least-privilege enforced *at the
database*, which is stronger and simpler than app-layer checks.

## Automation (n8n) — the brain

One webhook already receives every form. Route by the `type` field:

- `client-intake` → send you a Slack/email alert → create Supabase `clients`
  row → send client a welcome email (Resend) → create onboarding tasks →
  generate a proposal/invoice link (Stripe) → send it.
- `support-ticket` → create `tickets` row → notify you (urgent = SMS) →
  auto-reply to client with a ticket number.
- `website-lead` → create `leads` row → notify you → start a follow-up sequence.

Email templates (onboarding, reminders, updates, invoices, completion) live in
n8n + Resend. No app code required.

---

# Roadmap: MVP → enterprise

### ✅ Phase 1 — Foundation (DONE / live now)
- Marketing site, Command Center CRM, My Tools hub, client intake page,
  support page, Supabase auth + cloud sync, n8n lead capture.

### 🔜 Phase 2 — Connect the pipes (next, ~1–2 sessions)
- n8n workflows: intake → Supabase row + welcome email; ticket → notify + ack.
- Move CRM from the `kv` blob to the real tables above.
- Stripe Payment Links for deposits/invoices; paste link into a client's record.
- **Needs from you:** Resend API key (email), Stripe account + keys.

### �ク Phase 3 — Client portal
- `/portal` — clients log in (Supabase Auth, `client` role) to see their
  projects, files, invoices (pay via Stripe), and tickets. RLS keeps data
  isolated per client.
- File upload/download via Supabase Storage; contract e-sign via a link.

### 🏢 Phase 4 — Enterprise (only when scale demands)
- Migrate `/hq` + `/portal` into a single **Next.js + TypeScript + Tailwind**
  app on Vercel, Supabase as the backend, Prisma optional for typed queries.
- Add: audit logging, rate limiting (Vercel/Upstash), monitoring (Sentry),
  automated tests (Vitest/Playwright), GitHub Actions CI/CD, staged
  environments, and role/permission granularity for a team.

## Security posture (applied from Phase 2)
- Secrets in Vercel/Supabase **environment variables**, never in the repo.
  (The Supabase *publishable* key in the client is safe by design; the secret
  key never ships to the browser.)
- **RLS on every table** (least privilege).
- Input validation on every form + webhook; honeypot anti-spam (already in).
- Rate limiting on public endpoints; audit log table for admin actions.
- Weekly automated Supabase backups; export/restore already in the CRM.

## What each next step needs from you
| To unlock | Provide |
|-----------|---------|
| Onboarding + support emails | **Resend API key** (resend.com, free tier) |
| Invoices & payments | **Stripe account** → publishable + secret keys (secret goes in Vercel env, never the repo) |
| AI writing/research in ARIA | **Anthropic API key** |
| Client portal | Just a "go" — built on the Supabase you already have |
