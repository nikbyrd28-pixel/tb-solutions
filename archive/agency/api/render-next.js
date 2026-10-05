// TB Command · The Last Game — kick off rendering the next queued beat.
// Runs on a Vercel Cron (see vercel.json), one hour before post-next.
//
// The heavy render (stills → motion → voice → assembly → upscale) lives in
// Higgsfield. Two supported modes:
//
//   MODE A — Higgsfield API configured:
//     Set HIGGSFIELD_RENDER_URL + HIGGSFIELD_API_KEY. This function claims the
//     next queued beat, POSTs its narration/hook to that endpoint, and stores the
//     returned job id (and video_url if the endpoint returns one synchronously).
//
//   MODE B — no render API (default):
//     Rendering is done from the Last Game Studio / an MCP session (which holds the
//     Higgsfield connector). This function then just reports the backlog so the
//     poster always has something 'rendered' waiting — it never blocks posting.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, CRON_SECRET,
//      HIGGSFIELD_RENDER_URL (optional), HIGGSFIELD_API_KEY (optional)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RENDER_URL = process.env.HIGGSFIELD_RENDER_URL;
const RENDER_KEY = process.env.HIGGSFIELD_API_KEY;

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
  const auth = req.headers['authorization'] || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ ok: false, error: 'missing env (SUPABASE_URL, SUPABASE_SERVICE_KEY)' });
  }

  try {
    const backlog = await (await sb('tlg_segments?status=eq.rendered&video_url=not.is.null&select=id')).json();
    const backlogCount = Array.isArray(backlog) ? backlog.length : 0;

    // MODE B: no render API — report backlog, let the Studio/MCP produce renders.
    if (!RENDER_URL || !RENDER_KEY) {
      return res.status(200).json({
        ok: true, mode: 'studio', rendered_ready: backlogCount,
        message: 'No Higgsfield render API configured — render from Last Game Studio / MCP. Poster will use the ready backlog.',
      });
    }

    // MODE A: claim next queued beat and dispatch to the render API.
    const rows = await (await sb('tlg_segments?status=eq.queued&order=seq.asc&limit=1')).json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ ok: true, mode: 'api', rendered: false, rendered_ready: backlogCount, message: 'queue empty' });
    }
    const seg = rows[0];

    await sb(`tlg_segments?id=eq.${seg.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'rendering' }),
    });

    const r = await fetch(RENDER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RENDER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aspect_ratio: seg.aspect || '9:16',
        narration: seg.narration,
        hook: seg.hook_line,
        title: seg.title,
        style: 'two-world cinematic documentary; warm sodium Compton amber + crushed teal for streets, cold institutional blue-grey for power world; 35mm grain; anamorphic; dramatized recreations only; end on THE LAST GAME stencil card',
        captions: true,
      }),
    });
    const out = await r.json().catch(() => ({}));
    const videoUrl = out.video_url || out.url || null;
    const jobId = out.job_id || out.id || null;

    await sb(`tlg_segments?id=eq.${seg.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(
        videoUrl
          ? { status: 'rendered', video_url: videoUrl, render_job_id: jobId }
          : (r.ok ? { render_job_id: jobId } // still rendering; a webhook/poll finalizes
                  : { status: 'error', last_error: (out.message || 'render dispatch failed').slice(0, 500) })
      ),
    });

    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, mode: 'api', slug: seg.slug, job_id: jobId, video_url: videoUrl, rendered_ready: backlogCount });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
