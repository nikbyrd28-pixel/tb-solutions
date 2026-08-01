# THE LAST GAME — Faceless Auto-Channel

A hands-off content engine that turns the memoir into a stream of short-form videos and
**auto-posts them to TikTok, Instagram Reels, and YouTube Shorts** — on a schedule, with
zero clicks per post. Built on your existing stack: **Supabase** (state) + **Higgsfield**
(render) + **n8n** (publish).

```
tlg_segments (Supabase)  ──►  Render engine (Higgsfield, daily 9am)  ──►  status='rendered', video_url
        ▲                                                                        │
        └──────────  Auto-post (n8n, daily 10am) ◄───────────────────────────────┘
                     TikTok + IG Reels + YouTube Shorts → status='posted' → email recap
```

## What's in this folder
| File | Purpose |
|---|---|
| `01_supabase_schema.sql` | The queue tables + the book pre-cut into 16 short-form beats. **Already applied** to project **Base** (`qgbjiqdwzgkjkmqyjsmc`). |
| `02_franchise-autopost.n8n.json` | The n8n workflow that publishes rendered beats to all three platforms. |
| `03_render-engine.md` | How the render half works + the scheduled Routine that produces the videos. |
| `README.md` | This file. |

## Current status
- ✅ **State layer live** — 16 beats seeded, all `status='queued'`, in your Base DB.
- ✅ **Render engine defined** — daily job renders one 9:16 Short and writes it back.
- ✅ **First video rendering now** — the cold open (`two-photographs`).
- ⏳ **Auto-post workflow ready to import** — inactive until you do the 3 setup steps below
  (it publishes publicly, so it waits for your go).

## Setup — flip it fully live (~15 min, one time)

### 1. Import the n8n workflow
n8n → **Workflows → ⋯ → Import from File** → `02_franchise-autopost.n8n.json`.

### 2. Paste your Supabase service key
Supabase → **Settings → API keys** → copy **service_role**. Replace every
`PASTE_SERVICE_KEY` in these nodes: *Get next rendered, Mark posting, Mark posted, Log posts*.

### 3. Connect your socials for auto-posting (choose one)
The workflow posts to all three platforms in one call via a social API. Easiest is
**Ayrshare** (or upload-post.com / Blotato — same idea, swap the URL):
- Create an Ayrshare account → link your **TikTok, Instagram, and YouTube** accounts there.
- Copy your Ayrshare **API key** → paste it over `PASTE_AYRSHARE_KEY` in the
  *Post to TikTok+IG+YouTube* node.
- (TikTok direct API also works via the Higgsfield `tiktok_connect`/`tiktok_publish` tools
  if you'd rather post TikTok natively and use n8n only for IG+YT — ask me to wire that.)

### 4. Connect email + activate
On *Email recap*, pick your existing SMTP credential (same Gmail App Password you use for
the CRM autopilot). Save → flip **Active**.

That's it. Every day: a new Short renders at 9, publishes everywhere at 10, and you get an
email recap. When `tlg_segments` runs dry (all 16 posted), tell me and I'll cut the next
batch of beats from the book — there are 39 chapters, easily 40+ Shorts.

## Controls
- **Watch it work:** Supabase → Table editor → `tlg_segments` (watch `status` march
  queued → rendering → rendered → posting → posted) and `tlg_posts` (per-platform log).
- **Pause everything:** deactivate the n8n workflow (stops posting) and ask me to pause the
  render Routine (stops rendering). Nothing goes public while posting is off.
- **Reorder / edit:** change any row's `narration`, `caption`, `hashtags`, or `seq` in the
  Supabase table editor before it renders — the engine reads live values.
- **Redo one:** set a row back to `status='queued'` (clears it for a fresh render) or ask me
  to re-render a specific slug.

## Safety notes
- Nothing publishes until **you** connect accounts + activate (step 3–4). Until then videos
  accumulate privately as `rendered`.
- Content is framed to the public record (Gary Webb's *Dark Alliance*, the Kerry Committee,
  the CIA IG report) and uses dramatized recreations — no real living person's likeness.
- Keep the **service_role** key in n8n only, never in a browser/website (same rule as your
  CRM autopilot).
