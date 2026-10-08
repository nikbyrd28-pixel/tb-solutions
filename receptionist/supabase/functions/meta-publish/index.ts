import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// meta-publish — posts TB Solutions' Facebook / Instagram drafts from `agent_posts` to Meta.
// Runs every 15 min from pg_cron and on demand from HQ "Post now" (hq/supabase/011_hq_meta_publish.sql).
//   1. meta_due_posts() decides what is due (timer or Post now, under the retry cap).
//   2. The picture Visuals made lives on a Higgsfield CDN URL that can expire, so it is copied once
//      into the public `uploads` bucket (posts/<id>.jpg) and media_url is rewritten to that copy.
//   3. facebook  → POST /{page}/photos (picture + text)  or  /{page}/feed (text + link) when there is no picture
//      instagram → POST /{ig}/media (container) → /{ig}/media_publish → read permalink
//   4. Success: status posted, posted_at, external_id/url. Failure: publish_error, attempts+1 (3 strikes → stays draft, HQ shows why).
// Config comes from rx_config (META_PAGE_ID, META_PAGE_TOKEN, META_IG_USER_ID), env wins if set.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH = "https://graph.facebook.com/v21.0";
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const db = async <T>(path: string, init: RequestInit = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  const t = await r.text(); return (t ? JSON.parse(t) : null) as T;
};
let CFG: Record<string, string> = {};
async function loadCfg() { try { const rows = await db<any[]>("rx_config?select=key,value"); for (const r of rows || []) CFG[r.key] = r.value; } catch (e) { console.error("rx_config", e); } }
const cfg = (k: string) => Deno.env.get(k) || CFG[k] || "";

async function graph(path: string, params: Record<string, string>, token: string) {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...params, access_token: token }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`meta ${path}: ${(j.error && (j.error.message || JSON.stringify(j.error))) || r.status}`);
  return j;
}
async function graphGet(path: string, token: string) {
  const r = await fetch(`${GRAPH}/${path}&access_token=${encodeURIComponent(token)}`);
  return r.json().catch(() => ({}));
}

// copy the thumbnail into our own bucket so Meta fetches a URL that will not expire mid-upload
async function pinImage(post: any): Promise<string | null> {
  const url: string = post.media_url || "";
  if (!url) return null;
  if (url.startsWith(`${SB_URL}/storage/`)) return url;
  const src = await fetch(url);
  if (!src.ok) throw new Error(`image fetch ${src.status}`);
  const ct = src.headers.get("content-type") || "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const key = `posts/${post.id}.${ext}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/uploads/${key}`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": ct }, body: await src.arrayBuffer() });
  if (!up.ok) throw new Error(`image upload ${up.status} ${(await up.text()).slice(0, 200)}`);
  const pub = `${SB_URL}/storage/v1/object/public/uploads/${key}`;
  await db(`agent_posts?id=eq.${post.id}`, { method: "PATCH", body: JSON.stringify({ media_url: pub }) });
  return pub;
}

// explainer frames: media_url is frame 1, the rest are listed in media_note after "frames:"
const frames = (p: any): string[] => { const m = /frames:\s*([^\s]+)/.exec(p.media_note || ""); const rest = m ? m[1].split(",").filter(Boolean) : []; return p.media_url ? [p.media_url, ...rest] : rest; };

const text = (p: any) => [p.body, p.caption].filter((s) => s && String(s).trim()).join("\n\n").trim();

async function publishFacebook(p: any, img: string | null, token: string) {
  const page = cfg("META_PAGE_ID"); if (!page) throw new Error("META_PAGE_ID not set");
  let msg = text(p);
  if (p.cta_url && !msg.includes(p.cta_url)) msg += `\n\n${p.cta_url}`;
  const fr = frames(p);
  if (fr.length > 1) {
    const ids: string[] = [];
    for (const u of fr) { const ph = await graph(`${page}/photos`, { url: u, published: "false" }, token); ids.push(ph.id); }
    const params: Record<string, string> = { message: msg };
    ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
    const j = await graph(`${page}/feed`, params, token);
    return { id: j.id, url: `https://www.facebook.com/${j.id}` };
  }
  if (img) {
    const j = await graph(`${page}/photos`, { url: img, message: msg, published: "true" }, token);
    const id = j.post_id || j.id;
    return { id, url: `https://www.facebook.com/${id}` };
  }
  const params: Record<string, string> = { message: msg };
  if (p.cta_url) params.link = p.cta_url;
  const j = await graph(`${page}/feed`, params, token);
  return { id: j.id, url: `https://www.facebook.com/${j.id}` };
}

async function publishInstagram(p: any, img: string | null, token: string) {
  const ig = cfg("META_IG_USER_ID"); if (!ig) throw new Error("META_IG_USER_ID not set — Instagram skipped");
  if (!img) throw new Error("no image yet");
  const caption = text(p).slice(0, 2200);
  const fr = frames(p);
  let c: any;
  if (fr.length > 1) {
    const children: string[] = [];
    for (const u of fr.slice(0, 10)) {
      const ch = await graph(`${ig}/media`, { image_url: u, is_carousel_item: "true" }, token);
      children.push(ch.id);
    }
    c = await graph(`${ig}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token);
  } else {
    c = await graph(`${ig}/media`, { image_url: img, caption }, token);
  }
  // the container needs a moment to be ready; poll briefly
  for (let i = 0; i < 10; i++) {
    const s = await graphGet(`${c.id}?fields=status_code`, token);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error("ig container error");
    await new Promise((r) => setTimeout(r, 2000));
  }
  const pub = await graph(`${ig}/media_publish`, { creation_id: c.id }, token);
  const perm = await graphGet(`${pub.id}?fields=permalink`, token);
  return { id: pub.id, url: perm.permalink || `https://www.instagram.com/` };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  await loadCfg();
  const SECRET = cfg("RX_SYNC_SECRET");
  if (SECRET && req.headers.get("x-rx-sync-secret") !== SECRET) return new Response("nope", { status: 401 });
  const token = cfg("META_PAGE_TOKEN");
  const body = await req.json().catch(() => ({}));

  // on-demand (Post now) carries an id; otherwise take whatever is due
  let due: any[] = [];
  if (body.id) due = await db<any[]>(`agent_posts?id=eq.${body.id}&status=eq.draft&select=*`);
  else due = (await db<any[]>("rpc/meta_due_posts", { method: "POST", body: "{}" })) || [];

  const out: Record<string, any> = { posted: 0, failed: 0, skipped: 0, detail: [] as string[] };
  if (!token) { out.skipped = due.length; out.detail.push("META_PAGE_TOKEN not set"); return Response.json(out); }

  for (const p of due) {
    // claim it so an overlapping run cannot post twice
    const claimed = await db<any[]>(`agent_posts?id=eq.${p.id}&status=eq.draft&publish_attempts=eq.${p.publish_attempts}`, { method: "PATCH", body: JSON.stringify({ publish_attempts: p.publish_attempts + 1 }) });
    if (!claimed?.length) { out.skipped++; continue; }
    try {
      const img = await pinImage(p);
      let r;
      if (p.channel === "script") {
        // an explainer goes to both: the carousel on Instagram, the photo set on Facebook. IG link is what we keep.
        const fb = await publishFacebook(p, img, token).catch((e) => { console.error("script fb", e); return null; });
        const igr = cfg("META_IG_USER_ID") ? await publishInstagram(p, img, token) : null;
        r = igr || fb; if (!r) throw new Error("neither channel posted");
      } else r = p.channel === "instagram" ? await publishInstagram(p, img, token) : await publishFacebook(p, img, token);
      await db(`agent_posts?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ status: "posted", posted_at: new Date().toISOString(), external_id: r.id, external_url: r.url, publish_error: null }) });
      await db("agent_runs", { method: "POST", body: JSON.stringify({ agent: "meta", business_id: null, note: `published ${p.channel}: ${p.title || ""} → ${r.url}` }) }).catch(() => {});
      out.posted++; out.detail.push(`${p.channel} ok ${r.id}`);
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 300);
      await db(`agent_posts?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ publish_error: msg }) }).catch(() => {});
      out.failed++; out.detail.push(`${p.channel} fail: ${msg}`);
    }
  }
  return Response.json(out);
});
