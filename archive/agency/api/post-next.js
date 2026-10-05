// TB Command · The Last Game — auto-post one rendered beat to socials.
// Runs on a Vercel Cron (see vercel.json). Reliable, no npm deps (uses global fetch).
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL           e.g. https://qgbjiqdwzgkjkmqyjsmc.supabase.co
//   SUPABASE_SERVICE_KEY   the service_role key (server-only, never client)
//   AYRSHARE_KEY           Ayrshare API key with TikTok/Instagram/YouTube linked
//   CRON_SECRET            any long random string (Vercel sends it on cron calls)
//
// Flow: pick lowest-seq status='rendered' (has video_url) → post to all 3 platforms
//       → mark 'posted' (+ ids) → log to tlg_posts. One beat per invocation.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AYRSHARE_KEY = process.env.AYRSHARE_KEY;

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

module.exports = async (req, res) => {
  // Only allow Vercel Cron (or a caller who knows CRON_SECRET).
  const auth = req.headers['authorization'] || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY || !AYRSHARE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing env (SUPABASE_URL, SUPABASE_SERVICE_KEY, AYRSHARE_KEY)' });
  }

  try {
    // 1. Next rendered, unposted beat.
    const q = 'tlg_segments?status=eq.rendered&video_url=not.is.null&order=seq.asc&limit=1';
    const rows = await (await sb(q)).json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ ok: true, posted: false, message: 'nothing rendered to post' });
    }
    const seg = rows[0];

    // 2. Claim it.
    await sb(`tlg_segments?id=eq.${seg.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'posting' }),
    });

    // 3. Build caption + post to all three platforms via Ayrshare.
    const tags = (seg.hashtags || []).map((t) => '#' + String(t).replace(/[^A-Za-z0-9]/g, '')).join(' ');
    const caption = [seg.caption || seg.title, tags].filter(Boolean).join('\n\n');
    const payload = {
      post: caption,
      platforms: ['tiktok', 'instagram', 'youtube'],
      mediaUrls: [seg.video_url],
      isVideo: true,
      instagramOptions: { reels: true },
      youTubeOptions: { title: seg.title, shorts: true, visibility: 'public' },
    };
    const ayr = await fetch('https://api.ayrshare.com/api/post', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AYRSHARE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await ayr.json();

    // 4. Map per-platform ids.
    const byPlat = {};
    (result.postIds || []).forEach((p) => { byPlat[p.platform] = p; });
    const pick = (p) => (byPlat[p] && (byPlat[p].postUrl || byPlat[p].id)) || null;
    const ok = ayr.ok && (result.status === 'success' || (result.postIds && result.postIds.length));

    // 5. Write final status.
    await sb(`tlg_segments?id=eq.${seg.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: ok ? 'posted' : 'error',
        posted_at: ok ? new Date().toISOString() : null,
        tiktok_post_id: pick('tiktok'),
        ig_post_id: pick('instagram'),
        yt_video_id: pick('youtube'),
        last_error: ok ? null : (result.message || JSON.stringify(result)).slice(0, 500),
      }),
    });

    // 6. Log.
    if (ok) {
      await sb('tlg_posts', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(['tiktok', 'instagram', 'youtube'].map((p) => ({
          segment_id: seg.id, platform: p, external_id: pick(p), url: pick(p),
          status: pick(p) ? 'ok' : 'skipped',
        }))),
      });
    }

    return res.status(ok ? 200 : 502).json({
      ok, slug: seg.slug, title: seg.title,
      tiktok: pick('tiktok'), instagram: pick('instagram'), youtube: pick('youtube'),
      ayrshare: result.status || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
