// Loop Command Center — Comment → DM.
// Meta calls this endpoint the moment someone comments on a connected Instagram post
// or Facebook Page post. If the comment matches one of the shop's keyword rules we
// send that person a DM (and optionally reply under the comment).
//
// Set the Callback URL in the Meta app to:
//   https://tbsol.net/api/ig-webhook?k=<IG_WEBHOOK_KEY>
// and the Verify Token to IG_VERIFY_TOKEN. Full walkthrough: hq/comment-to-dm-setup.md
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL           e.g. https://qgbjiqdwzgkjkmqyjsmc.supabase.co
//   SUPABASE_SERVICE_KEY   the service_role key (server-only, never client)
//   IG_VERIFY_TOKEN        any long random string; also typed into the Meta app
// Optional but recommended:
//   IG_APP_SECRET          Meta app secret — lets us verify the X-Hub-Signature-256
//   IG_WEBHOOK_KEY         secret in the ?k= query string; the fallback check when
//                          the platform has already consumed the raw request body
//   IG_PAGE_TOKEN          Page access token, used when dm_accounts has none of its own
//
// Until the env vars exist this endpoint stays dormant and answers 503 — nothing else
// in the command center is affected.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const APP_SECRET = process.env.IG_APP_SECRET;
const WEBHOOK_KEY = process.env.IG_WEBHOOK_KEY;
const FALLBACK_TOKEN = process.env.IG_PAGE_TOKEN;

const GRAPH = 'https://graph.facebook.com/v21.0';

function rpc(fn, args) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  }).then((r) => r.json());
}

// Vercel parses JSON bodies for us, which throws away the exact bytes Meta signed.
// Read the stream when it is still readable so the signature check can be byte-exact.
function rawBody(req) {
  return new Promise((resolve) => {
    if (!req.readable) return resolve(null);
    let buf = '', settled = false;
    const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    // If the body was already drained upstream this stream may never emit 'end'.
    // Give up rather than hold the function open until Meta times out and retries.
    const timer = setTimeout(() => done(null), 2000);
    req.on('data', (c) => { buf += c; });
    req.on('end', () => done(buf));
    req.on('error', () => done(null));
  });
}

function signatureOk(raw, header) {
  if (!APP_SECRET || !raw || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Pull the comment events out of either payload shape Meta sends us.
function extractComments(body) {
  const out = [];
  const entries = (body && body.entry) || [];
  const isPage = body && body.object === 'page';
  entries.forEach((entry) => {
    (entry.changes || []).forEach((ch) => {
      const v = ch.value || {};
      if (isPage) {
        // Facebook Page feed: only brand-new comments from someone else.
        if (ch.field !== 'feed' || v.item !== 'comment' || v.verb !== 'add') return;
        out.push({
          platform: 'facebook',
          accountId: String(entry.id || ''),
          commentId: String(v.comment_id || ''),
          fromId: String((v.from && v.from.id) || ''),
          fromName: (v.from && v.from.name) || null,
          text: v.message || '',
        });
      } else {
        if (ch.field !== 'comments') return;
        // Replies to our own replies would loop; only act on top-level comments.
        if (v.parent_id) return;
        out.push({
          platform: 'instagram',
          accountId: String(entry.id || ''),
          commentId: String(v.id || ''),
          fromId: String((v.from && v.from.id) || ''),
          fromName: (v.from && v.from.username) || null,
          text: v.text || '',
        });
      }
    });
  });
  return out;
}

function personalize(tpl, ev) {
  const first = String(ev.fromName || 'there').split(/\s+/)[0].replace(/^@/, '');
  return String(tpl || '').replace(/\{name\}/g, first).replace(/\{keyword\}/g, ev.text || '');
}

async function graph(path, params) {
  const r = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, detail: (j.error && j.error.message) || (r.ok ? '' : `HTTP ${r.status}`) };
}

// Instagram wants the Messaging API; a Facebook Page comment wants private_replies.
// Try the native route first, then fall back — the two APIs have swapped over the years.
async function sendDm(ev, accountId, token, text) {
  if (ev.platform === 'instagram') {
    const a = await graph(`${accountId}/messages?access_token=${encodeURIComponent(token)}`, {
      recipient: { comment_id: ev.commentId },
      message: { text },
    });
    if (a.ok) return a;
    const b = await graph(`${ev.commentId}/private_replies?access_token=${encodeURIComponent(token)}`, { message: text });
    return b.ok ? b : { ok: false, detail: a.detail || b.detail };
  }
  return graph(`${ev.commentId}/private_replies?access_token=${encodeURIComponent(token)}`, { message: text });
}

async function handle(ev) {
  const claim = await rpc('dm_claim', {
    p_ig_user_id: ev.accountId,
    p_platform: ev.platform,
    p_comment_id: ev.commentId,
    p_commenter_id: ev.fromId,
    p_commenter_name: ev.fromName,
    p_text: ev.text,
  });
  // No rule matched, already handled, or the account isn't connected — nothing to do.
  if (!claim || claim.ok !== true) return { skipped: (claim && claim.reason) || 'no claim' };

  const token = claim.page_token || FALLBACK_TOKEN;
  if (!token) {
    await rpc('dm_finish', { p_log_id: claim.log_id, p_status: 'error', p_error: 'no page access token' });
    return { error: 'no page access token' };
  }

  const body = [personalize(claim.message, ev), claim.link].filter(Boolean).join('\n\n');
  const dm = await sendDm(ev, ev.accountId, token, body);

  // The public reply is a nudge ("check your DMs"), never the point — its failure
  // must not mark a delivered DM as failed.
  if (dm.ok && claim.public_reply) {
    await graph(`${ev.commentId}/replies?access_token=${encodeURIComponent(token)}`, {
      message: personalize(claim.public_reply, ev),
    }).catch(() => {});
  }

  await rpc('dm_finish', {
    p_log_id: claim.log_id,
    p_status: dm.ok ? 'sent' : 'error',
    p_error: dm.ok ? null : dm.detail,
  });
  return dm.ok ? { sent: true } : { error: dm.detail };
}

module.exports = async (req, res) => {
  if (!SUPABASE_URL || !SERVICE_KEY || !VERIFY_TOKEN) {
    return res.status(503).json({ ok: false, error: 'comment-to-DM not configured (SUPABASE_URL, SUPABASE_SERVICE_KEY, IG_VERIFY_TOKEN)' });
  }

  // Meta's one-time subscription handshake.
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === VERIFY_TOKEN) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(q['hub.challenge'] || ''));
    }
    return res.status(403).json({ ok: false, error: 'verify token mismatch' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const raw = await rawBody(req);
  const sigHeader = req.headers['x-hub-signature-256'];
  const signed = signatureOk(raw, sigHeader);
  // Prefer the real signature. When the body was parsed before we could read it, fall
  // back to the secret Meta echoes back in the callback URL's query string.
  if (!signed) {
    const key = (req.query || {}).k;
    if (!WEBHOOK_KEY || key !== WEBHOOK_KEY) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  }

  let body = req.body;
  if (raw) { try { body = JSON.parse(raw); } catch (e) { body = req.body; } }
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }

  // Meta retries anything that isn't a fast 200, so never fail the whole delivery
  // because one comment in the batch blew up.
  try {
    const events = extractComments(body);
    const results = await Promise.all(events.map((ev) => handle(ev).catch((e) => ({ error: String((e && e.message) || e) }))));
    return res.status(200).json({ ok: true, handled: events.length, results });
  } catch (e) {
    return res.status(200).json({ ok: true, handled: 0, error: String((e && e.message) || e) });
  }
};
