import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// rank-audit: runs the machine half of the Google Rank Fix playbook for one client project.
//
// POST { project_id }            from HQ (admin JWT) after "+ New client" or "Re-run audit"
// POST { mode: "monthly" }        from pg_cron (x-rx-sync-secret): every active/done project,
//                                 anything that slipped flips back to todo on the board
//
// For each project: find it on Google Places (by place id, else name + town), pull the top 3
// competitors and any other listing on the same phone, open the website (plus sitemap/robots/
// llms, plus the http:// address to see if it bounces to https), grade everything in checks.ts
// and hand the results to rank_audit_apply() in SQL, which writes the one-line finding, the
// status and the evidence onto the matching hq_project_items rows.
//
// Needs GOOGLE_PLACES_KEY (env or rx_config, same as hq-finder) and RX_SYNC_SECRET for cron.
// Nothing here contacts anyone. Everything read is public: their listing, their own site.

import { analyzeHtml, buildResults, pickPlace, placeIdFrom, normPhone, fmtPhone, type Place, type SiteFetch, type Result } from "./checks.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-rx-sync-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const REST = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const FIELDS = "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,websiteUri,types,primaryType,primaryTypeDisplayName,regularOpeningHours,photos,pureServiceAreaBusiness,businessStatus,googleMapsUri";

let CFG: Record<string, string> = {};
async function loadConfig() {
  if (Object.keys(CFG).length) return;
  try { const r = await fetch(`${SB_URL}/rest/v1/rx_config?select=key,value`, { headers: REST }); if (r.ok) for (const row of await r.json()) CFG[row.key] = row.value; }
  catch (e) { console.error("rx_config load failed", e); }
}
const cfg = (k: string) => Deno.env.get(k) || CFG[k] || "";

async function isAdmin(auth: string | null) {
  if (!auth) return false;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/is_hq_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: REST, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// ---- Google Places (New) ----
async function placeSearch(key: string, text: string, max = 10): Promise<Place[]> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS.split(",").map(f => "places." + f).join(",") },
    body: JSON.stringify({ textQuery: text, pageSize: Math.min(20, max), languageCode: "en", regionCode: "US" }),
  });
  if (!r.ok) throw new Error(`Google Places ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return ((await r.json()).places || []) as Place[];
}
async function placeGet(key: string, id: string): Promise<Place | null> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Google Places ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json() as Place;
}

// ---- website ----
async function get(url: string, ms = 8000, redirect: RequestRedirect = "follow") {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, redirect, headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
    const html = (await r.text()).slice(0, 600_000);
    return { ok: r.ok, status: r.status, html, finalUrl: r.url || url, bytes: Number(r.headers.get("content-length")) || html.length, location: r.headers.get("location") };
  } catch { return { ok: false, status: 0, html: "", finalUrl: url, bytes: 0, location: null }; }
  finally { clearTimeout(t); }
}
async function fetchSite(raw: string): Promise<SiteFetch> {
  const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  const home = await get(url);
  const out: SiteFetch = { url, reachable: home.ok && home.html.length > 200, status: home.status, finalUrl: home.finalUrl, html: home.html, bytes: home.bytes, http_redirects_to_https: null, redirect_hops: 0, sitemap: null, robots: null, llms: null };
  if (!out.reachable) return out;
  const origin = new URL(home.finalUrl).origin;
  // count hops by walking manual redirects from the given URL (max 5)
  let cur = url, hops = 0;
  for (; hops < 5; hops++) { const r = await get(cur, 5000, "manual"); if (r.status >= 300 && r.status < 400 && r.location) { try { cur = new URL(r.location, cur).href; } catch { break; } } else break; }
  out.redirect_hops = hops;
  if (/^https:/i.test(home.finalUrl)) {
    const h = await get(home.finalUrl.replace(/^https:/i, "http:"), 5000, "manual");
    out.http_redirects_to_https = h.status === 0 ? null : h.status >= 300 && h.status < 400 && /^https:/i.test(h.location || "");
  }
  const [sm, rb, ll] = await Promise.all([get(origin + "/sitemap.xml", 5000), get(origin + "/robots.txt", 5000), get(origin + "/llms.txt", 5000)]);
  out.sitemap = sm.status === 0 ? null : sm.ok && /<(urlset|sitemapindex)/i.test(sm.html);
  out.robots = rb.status === 0 ? null : rb.ok && /user-agent/i.test(rb.html);
  out.llms = ll.status === 0 ? null : ll.ok && !/<html/i.test(ll.html.slice(0, 500)) && ll.html.trim().length > 20;
  return out;
}

// ---- one project ----
type Proj = { id: string; name: string; trade: string | null; town: string | null; phone: string | null; website: string | null; gbp_url: string | null; place_id: string | null };
async function audit(key: string, p: Proj) {
  let place: Place | null = null;
  const pid = p.place_id || placeIdFrom(p.gbp_url);
  if (pid) { try { place = await placeGet(key, pid); } catch (e) { console.error("placeGet", e); } }
  if (!place) place = pickPlace(await placeSearch(key, [p.name, p.town].filter(Boolean).join(" "), 10), p);

  const town = p.town || (place?.formattedAddress?.match(/,\s*([^,]+,\s*[A-Z]{2})\s*\d{5}/) || [])[1] || "";
  const trade = p.trade || place?.primaryTypeDisplayName?.text || "";
  const [compRaw, dupRaw] = await Promise.all([
    trade && town ? placeSearch(key, `${trade} ${town}`, 20).catch(() => [] as Place[]) : Promise.resolve([] as Place[]),
    (() => { const ph = normPhone(place?.nationalPhoneNumber) || normPhone(p.phone); return ph ? placeSearch(key, fmtPhone(ph), 10).catch(() => [] as Place[]) : Promise.resolve([] as Place[]); })(),
  ]);
  const self = place?.id;
  const competitors = compRaw.filter(c => c.id !== self).map(c => ({ name: c.displayName?.text || "", reviews: c.userRatingCount ?? 0, rating: c.rating ?? null })).sort((a, b) => b.reviews - a.reviews).slice(0, 3);
  const ph = normPhone(place?.nationalPhoneNumber) || normPhone(p.phone);
  const duplicates = dupRaw.filter(c => c.id !== self && ph && normPhone(c.nationalPhoneNumber || c.internationalPhoneNumber) === ph).map(c => ({ id: c.id, name: c.displayName?.text || "", address: c.formattedAddress }));

  const siteUrl = p.website || place?.websiteUri || null;
  const site = siteUrl ? await fetchSite(siteUrl) : null;
  const html = site?.reachable ? analyzeHtml(site.html) : null;
  const results: Result[] = buildResults({ project: p, site, html, place, competitors, duplicates });
  const summary = {
    place_id: place?.id ?? null, google_name: place?.displayName?.text ?? null, google_maps: place?.googleMapsUri ?? null,
    website: site?.finalUrl ?? siteUrl, reviews: place?.userRatingCount ?? null, rating: place?.rating ?? null, competitors, duplicates: duplicates.length,
  };
  const applied = await rpc<{ ok: boolean; done: number; total: number; regressed: number; updated: number }>("rank_audit_apply", { p_project: p.id, p_results: results, p_summary: summary });
  return { project_id: p.id, name: p.name, ...summary, ...applied, ok: true, checks: results.map(r => ({ key: r.key, check: r.check })) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return Response.json({ ok: false, error: "POST only" }, { status: 405, headers: CORS });
  await loadConfig();
  let b: { project_id?: string; mode?: string }; try { b = await req.json(); } catch { b = {}; }

  const secret = cfg("RX_SYNC_SECRET");
  const fromCron = !!secret && req.headers.get("x-rx-sync-secret") === secret;
  if (!fromCron && !(await isAdmin(req.headers.get("authorization")))) return Response.json({ ok: false, error: "not admin" }, { status: 403, headers: CORS });

  const key = cfg("GOOGLE_PLACES_KEY");
  if (!key) return Response.json({ ok: false, error: "no_key", message: "Google Places key missing. Save it in HQ → Finder." }, { status: 200, headers: CORS });

  let ids: string[] = [];
  if (b.mode === "monthly") ids = await rpc<string[]>("rank_audit_due", {});
  else if (b.project_id && /^[0-9a-f-]{36}$/i.test(b.project_id)) ids = [b.project_id];
  else return Response.json({ ok: false, error: "project_id required" }, { status: 400, headers: CORS });

  const out: unknown[] = [];
  for (const id of ids) {
    const r = await fetch(`${SB_URL}/rest/v1/hq_projects?id=eq.${id}&select=id,name,trade,town,phone,website,gbp_url,place_id`, { headers: REST });
    const p = (r.ok ? await r.json() : [])[0] as Proj | undefined;
    if (!p) { out.push({ ok: false, project_id: id, error: "not found" }); continue; }
    try { out.push(await audit(key, p)); }
    catch (e) {
      const msg = String((e as Error).message || e).slice(0, 300); console.error("audit failed", id, msg);
      await rpc("rank_audit_apply", { p_project: id, p_results: [], p_summary: null, p_error: msg }).catch(() => {});
      out.push({ ok: false, project_id: id, error: msg });
    }
  }
  return Response.json(ids.length === 1 && b.mode !== "monthly" ? out[0] : { ok: true, ran: out.length, results: out }, { headers: CORS });
});
