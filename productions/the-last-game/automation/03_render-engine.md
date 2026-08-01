# THE LAST GAME — Render Engine (the `queued → rendered` half)

The auto-channel has two halves that meet in the Supabase `tlg_segments` table:

```
 RENDER ENGINE  (Higgsfield)                 AUTO-POST  (n8n)
 ────────────────────────────                ────────────────────────────
 picks next status='queued'                  picks next status='rendered'
 generates a 9:16 Short                      posts to TikTok/IG/YouTube
 uploads → writes video_url                  advances queue → emails recap
 sets status='rendered'  ───────────────►    sets status='posted'
```

Keeping them decoupled through the database means either half can run on its own schedule, retry independently, and never block the other.

## How the render engine works (per run)

1. **Read** the next `status='queued'` row (lowest `seq`) from `tlg_segments`.
2. **Set** `status='rendering'` (so a second run can't grab the same row).
3. **Generate** a vertical (9:16) Short with the Higgsfield `faceless-channel-video`
   workflow (or `shorts_studio_create`), using the row's `narration` as the VO,
   `hook_line` as the first-2s on-screen hook, burned captions on, and the
   franchise two-world look (warm Compton amber / cold power-world blue).
4. **Upload** the finished file → get a hosted URL.
5. **Write back**: `status='rendered'`, `video_url=<hosted url>`, `render_job_id=<id>`.
   On failure: `status='error'`, `last_error=<message>` (the next run skips it and
   takes the following `queued` row; you can reset it to `queued` from the dashboard).

## The scheduled job (Claude Code Routine)

A Routine fires on a cron, spins up a session with the Higgsfield + Supabase
connectors, and runs exactly the prompt below. It renders **one** Short per firing
(so credit spend is paced and predictable) and writes the result back to the queue.

> **Arming note (important):** a Routine must carry the **Higgsfield + Supabase
> connectors** or its fired session can't reach those tools. Triggers created from
> inside this coding session can't attach connectors on this org, so **arm this from
> the claude.ai → Routines UI**, where you can attach connectors: create a new
> scheduled Routine, paste the prompt below, attach **Higgsfield** and **Supabase**,
> set the cron to daily 16:00 UTC (9am PT). Until it's armed there, I render beats
> **on demand from this session** (which already holds the connectors) — just say which
> ones, or "render the next 3."

**Standalone prompt the Routine runs each firing:**

> You are the render engine for "The Last Game" faceless auto-channel.
> 1. Query Supabase project `qgbjiqdwzgkjkmqyjsmc`, table `public.tlg_segments`, for the
>    single lowest-`seq` row with `status='queued'`. If none, stop and report "queue empty".
> 2. Immediately update that row to `status='rendering'`.
> 3. Using the Higgsfield `faceless-channel-video` workflow, produce ONE finished **9:16**
>    Short: VO = the row's `narration`; first-2s on-screen hook = `hook_line`; burned
>    captions ON; History/Documentary type; the two-world cinematic look (warm sodium
>    Compton amber + crushed teal / cold institutional blue for the power world); 35mm
>    grain; dramatized recreations only — never a real named living person's likeness.
>    End on a "THE LAST GAME" stencil title card. Run through the Topaz upscale + delivery.
> 4. Update the row: `status='rendered'`, `video_url=<confirmed hosted url>`,
>    `render_job_id=<id>`. On any hard failure, set `status='error'` and put the reason in
>    `last_error`, then stop.
> 5. Report the slug, the hosted URL, and credits spent.

**Cadence:** default **daily at 9:00 AM PT** (one hour before the 10 AM poster, so a
fresh Short is always `rendered` and waiting). Change or pause it anytime:
- Pause/adjust: your Routines list (or ask me to `update_trigger` / `delete_trigger`).
- Faster backfill: temporarily set it hourly to render the 16-beat backlog in ~a day.

> The render half only spends your Higgsfield credits and writes to *your* database —
> nothing goes public here. Publishing is the n8n half, which stays **inactive** until
> you connect your social accounts (see the README). That's the safety gate: videos pile
> up privately as `rendered` until you decide to flip posting on.

## Manual / on-demand render

You can also render any beat on demand (e.g. re-do one, or jump the queue): just ask
— "render the `gary-webb` short" — and I'll run the same pipeline for that slug and
write it back. The first one (`two-photographs`, the cold open) is already rendering.
