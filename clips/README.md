# Clip Engine — one livestream, a week of posts

```
YouTube VOD ──► worker (download → whisper → Claude picks → ffmpeg cuts) ──► clip_items (rendered)
                                                                               │
                      tbsol.net/clips/  ◄── you approve on your phone ◄────────┘
                                                                               │
                      n8n clip-publisher ──► Ayrshare ──► YT · IG · FB · TikTok · LinkedIn · X
```

Per stream:

| Cut | Length | Goes to | Default time |
|---|---|---|---|
| 2 × longform | 6–15 min, 16:9 | YouTube | now, +3 days |
| 1 × LinkedIn | 3–9 min, 16:9 | LinkedIn | tomorrow 9am ET |
| 1 × X | ≤ 2:20, 16:9 | X | in 2 hours |
| 5 × shorts | 25–58 s, 9:16, hook + burned captions | YT Shorts + IG/FB Reels + TikTok | one per day, noon ET |

= 20 posts from one stream. Nothing posts until you tap **Approve** (or **Approve all**).

## Setup (one time, ~30 min)

**1. Database (2 min)** — Supabase → SQL Editor → paste `supabase/001_clip_engine.sql` → Run.

**2. Worker (10 min)** — on the box that runs n8n:
```bash
git clone https://github.com/nikbyrd28-pixel/tb-solutions && cd tb-solutions/clips/worker
cp .env.example .env    # paste SUPABASE_SERVICE_KEY + ANTHROPIC_API_KEY
docker compose up -d --build
docker compose logs -f  # "clip worker up"
```
First run downloads the Whisper model (~500 MB) once. A 2-hour stream takes ~25–40 min on a 4-core VPS.
Test without waiting for a stream: `docker compose run clip-worker python clip_worker.py https://www.youtube.com/watch?v=XXXX`

**3. n8n (10 min)** — import `n8n/clip-intake.json` and `n8n/clip-publisher.json`:
- intake: put your channel id (starts with `UC…`) in *Channel feed*, service key in *Insert source*.
- publisher: make an [Ayrshare](https://www.ayrshare.com) account, link YouTube / Instagram / Facebook Page / TikTok / LinkedIn / X, paste the API key in *Post everywhere*, service key in the 4 Supabase nodes.
- Activate both.

**4. Review page** — tbsol.net/clips/ (HQ login). Paste a URL to clip anything on demand.

## Knobs
- `SHORT_STYLE=crop` (center 9:16, best for facecam) or `stack` (full frame over blurred background — for screen-share streams).
- `WHISPER_MODEL=small` → `medium` if captions miss words (3× slower).
- `CLIP_ONLY_LIVESTREAMS=true` to ignore normal uploads from the RSS feed.
- Schedule spacing lives in `schedule()` in `clip_worker.py`; per-clip times are editable on the card.
- Posting cost: Ayrshare Premium covers all six networks on one key. Cheaper swap is upload-post.com — same node, different URL/body.

## Tables
`clip_sources` (one per stream: status, transcript, the AI plan) · `clip_items` (one per rendered file: kind, platforms, times, title, caption, file_url, status, publish_at, post_ids). Files land in the public `uploads` bucket under `clips/<source>/<item>.mp4`.
