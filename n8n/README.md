# n8n automations for TB Solutions

Your full automation suite — import each file, do the small setup, flip Active.

## The suite (3 workflows)

| File | What it does automatically | Runs |
|---|---|---|
| **`crm-autopilot.json`** ⭐ | Every website submission handled: leads **saved straight into your CRM** (stage New, follow-up in 2 days) + instant email to you; intakes → email you + welcome email to the client; tickets → email you (urgent flagged) + "got it" to the client; portal signups → prospect alert | On every submission |
| **`daily-followups.json`** | Emails you the call list — every lead due (or overdue) for follow-up | Daily 8am |
| **`weekly-report.json`** | "Your week at TB Solutions": new leads, open requests, website visits + a tip | Mondays 8am |

> `lead-router.json` is the older version of the autopilot — if you imported
> it before, **deactivate/delete it** (same webhook address, they'd clash).

## One-time setup (~15 min total)

### 0. Database unlock (2 min)
Run **`hq/automation-setup.sql`** in Supabase (SQL Editor → paste → Run).
This lets the autopilot write leads into your CRM.

### 1. Import the workflows
Download each `.json` from GitHub (repo → n8n folder → file → Download raw).
In n8n: **Workflows → ⋯ → Import from File** → pick the file. Repeat for all 3.

### 2. Paste your service key (the "master key" — n8n only, never a website)
Supabase → **Settings → API keys** → copy the **service_role** key.
Paste it over every `PASTE_SERVICE_KEY` (they're in node headers):
- crm-autopilot → **Save lead to CRM** node (2 headers)
- daily-followups → **Get due leads** node (2 headers)
- weekly-report → all three **Get…** nodes (2 headers each)

### 3. Connect your email (once, reused everywhere)
Open any Email node → Credential → **Create new (SMTP)**:
- Host `smtp.gmail.com` · Port `465` · SSL on · User `nikbyrd28@gmail.com`
- Password = a Gmail **App Password** (Google Account → Security →
  2-Step Verification → App passwords → create one named "n8n").
  Your normal Gmail password will NOT work.
Then select that same credential on every Email node in all 3 workflows.

### 4. Activate
Save each workflow → flip the **Active** toggle (top-right) on all 3.

## Test it end-to-end (2 min)
1. Submit the form at the bottom of **tbsol.net** with test info.
2. Within seconds: email in your inbox ✅
3. Open **tbsol.net/hq → Leads**: the test lead is sitting in "New" with a
   follow-up date ✅
4. n8n → **Executions** tab shows the run ✅ (this is where you "see your
   automation" working — every firing is logged there)

## Troubleshooting
- **No email:** Email node credential missing, or Gmail App Password wrong.
- **Email but no lead in CRM:** service key not pasted in *Save lead to CRM*,
  or `hq/automation-setup.sql` not run.
- **Nothing at all:** workflow not Active, or the old lead-router is still
  Active and stealing the webhook.

---

## NEW: AI suite (Marketing Engine + client CRM)

These run on ONE free Google Gemini key — no OpenAI/Anthropic needed.

| File | What it does | Runs |
|---|---|---|
| **`marketing-engine-ai.json`** ⭐ | Powers **tbsol.net/marketing-engine** — generates marketing plans, ad copy, website copy, email sequences, social calendars, research briefs, sales one-pagers per client | When you hit Generate |
| **`outreach-autopilot.json`** | AI writes a personalized follow-up/outreach draft for every lead whose follow-up date is due, emails the drafts to you ready to send + alerts you about open tickets | Daily 8am |
| **`prospect-scanner.json`** | Finds Chester County businesses with NO website via Google Places, adds them to your CRM, emails you the Monday hit list (needs a free Places API key in the node) | Mondays 7am |
| **`clients/voomlux-crm-intake.json`** | VoomLux booking form → AI lead scoring 0–100 → client CRM → instant auto-reply → 🔥 alert if hot | Every submission |
| **`clients/voomlux-followup-sequencer.json`** | Chases every quiet VoomLux lead: AI-written touch 1 / 2 / 3, then marks Lost | Daily 9am |
| **`clients/voomlux-review-rebook.json`** | Completed rides → review request + rebook nudge | Daily 10am |

### Setup (once)

1. **Gemini credential** (free): aistudio.google.com/apikey → create key. In n8n, open any imported workflow above → tap the Google Gemini node → Credential → Create new → paste key. Reuse this same credential on every Gemini node.
2. **Import from URL** — in n8n: ⋯ → Import from URL → e.g. `https://tbsol.net/n8n/marketing-engine-ai.json` (same pattern for each file above — no downloads).
3. Email nodes use your existing **SMTP credential** (same one as the older suite — Gmail App Password). Select it on each Email node.
4. Supabase nodes: create a **Supabase credential** per project — TB Base (`qgbjiqdwzgkjkmqyjsmc.supabase.co`) for the TB workflows, VoomLux CRM (`ewipzalkaybrsyxlhlob.supabase.co`) for the clients/ workflows. Use each project's **service_role** key (Supabase → Settings → API keys).
5. Flip each workflow **Active**. Start with `marketing-engine-ai.json` — then tbsol.net/marketing-engine works end to end.

---

## Ops workflows (Phase 1 — production readiness)

| File | What it does | Runs |
|---|---|---|
| **`uptime-monitor.json`** | Pings tbsol.net + /hq; emails you 🚨 the moment either is down | Every 30 min |
| **`weekly-backup.json`** | Dumps every CRM table to your private `backups` storage bucket + confirmation email (see sticky note inside for the 2-min setup) | Sundays 6am |

Import both from URL: `https://tbsol.net/n8n/uptime-monitor.json` and `https://tbsol.net/n8n/weekly-backup.json`.
