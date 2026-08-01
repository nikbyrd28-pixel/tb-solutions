# THE LAST GAME — Vercel-native engine (recommended)

Since you upgraded Vercel, the auto-channel can run entirely on **your Vercel + Supabase**
— no n8n, no separate worker. Two serverless functions on a Vercel Cron do the loop.

```
Vercel Cron 09:00 PT ─► /api/render-next  ─► claims next 'queued', renders, writes video_url
Vercel Cron 10:00 PT ─► /api/post-next    ─► posts next 'rendered' to TikTok/IG/YT, logs, advances
        state for both  ◄──────────────────  Supabase  tlg_segments / tlg_posts
```

Both are plain Node functions using global `fetch` — **no `npm install`, no dependencies.**

## Files
| File | Role |
|---|---|
| `api/post-next.js` | Auto-poster. Fully working: Supabase → Ayrshare → all 3 platforms → log. |
| `api/render-next.js` | Render dispatcher. Mode A (Higgsfield API) or Mode B (render from the Studio/MCP; this just reports backlog). |
| `vercel.json` | Registers the two functions + their cron schedules (16:00 & 17:00 UTC = 9 & 10 AM PT). |

## Setup (Vercel → Project → Settings → Environment Variables)
Add these (Production), then redeploy:

| Var | Value |
|---|---|
| `SUPABASE_URL` | `https://qgbjiqdwzgkjkmqyjsmc.supabase.co` |
| `SUPABASE_SERVICE_KEY` | your Supabase **service_role** key (server-only) |
| `AYRSHARE_KEY` | Ayrshare API key with TikTok/Instagram/YouTube linked |
| `CRON_SECRET` | any long random string — Vercel auto-sends it as `Authorization: Bearer …` on cron calls; the functions reject anything else, so the endpoints aren't publicly triggerable |
| `HIGGSFIELD_RENDER_URL` | *(optional, Mode A)* your Higgsfield render endpoint |
| `HIGGSFIELD_API_KEY` | *(optional, Mode A)* Higgsfield API key |

Vercel Cron only runs on **Production** deployments, so this goes live when the branch is
merged to `main` (or you promote a deployment).

## Render: Mode A vs Mode B
- **Mode B (default, no extra config):** leave the two `HIGGSFIELD_*` vars unset. Rendering
  is produced from **Last Game Studio** (owner-only dashboard) or an MCP session — either
  fills the queue with `rendered` clips. `/api/render-next` just reports how many are ready
  and never blocks posting. This is the reliable default today.
- **Mode A (fully autonomous render):** once you have a Higgsfield render API endpoint that
  accepts `{narration, hook, aspect_ratio}` and returns a `video_url` (or job id), set the
  two `HIGGSFIELD_*` vars. `/api/render-next` will then claim + dispatch renders on the cron
  with zero human touch.

## Test it (after deploy + env vars)
```
# should return "nothing rendered to post" or actually post the next ready beat
curl -H "Authorization: Bearer <CRON_SECRET>" https://tbsol.net/api/post-next
curl -H "Authorization: Bearer <CRON_SECRET>" https://tbsol.net/api/render-next
```
Watch the effect live in **Last Game Studio** (`/command/the-last-game/`) — statuses march
`queued → rendering → rendered → posting → posted` and the recap lands in `tlg_posts`.

## n8n vs Vercel
The n8n workflow (`02_franchise-autopost.n8n.json`) still works and is a fine alternative,
but the Vercel engine is simpler to own (one deploy, one secret set, no external automation
tool). Pick one poster — don't run both, or a beat could post twice.
