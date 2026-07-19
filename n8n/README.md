# n8n automations for TB Solutions

Ready-to-import workflows. Import → attach your email → flip Active.

## Workflow 1: Lead Router (`lead-router.json`)

**What it does automatically, 24/7:**
- Website lead → emails you instantly ("🔥 New lead")
- Client intake (`tbsol.net/start`) → emails you + sends the client a welcome email with your booking link
- Support ticket (`tbsol.net/support`) → emails you (urgent tickets flagged 🔴) + sends the client a "got it" confirmation

**How to install (5 minutes):**
1. Open your n8n → **Workflows** → **⋯ (three dots) → Import from File** →
   pick `lead-router.json` (download it from GitHub first: repo → n8n folder →
   the file → Download raw).
2. Your old webhook workflow uses the same address — **deactivate or delete
   the old one** so they don't clash.
3. Open each of the 5 **Email** nodes → under *Credential*, click
   **Create new credential** → easiest is **SMTP with Gmail**:
   - Host: `smtp.gmail.com`, Port: `465`, SSL: on
   - User: `nikbyrd28@gmail.com`
   - Password: a Gmail **App Password** (Google Account → Security →
     2-Step Verification → App passwords → make one for "n8n")
   - Save once — then just select that same credential on the other email nodes.
4. **Save** the workflow, then flip it **Active** (top-right toggle).
5. Test: submit the form on tbsol.net → you should get the email within seconds.

> Tip: don't use your normal Gmail password — it won't work. It must be an
> **App Password** (16 letters, Google generates it).

## Coming next (as you're ready)
- Save every intake/ticket into Supabase tables automatically (needs your
  Supabase service key added as an n8n credential — paste it in n8n only,
  never in chat or code).
- Follow-up reminder emails on a schedule.
- Weekly "what happened" digest.
