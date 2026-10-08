import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// HQ Finder — the lead scanner behind HQ → Finder.
//
// POST { trade: "plumber", city: "Phoenixville, PA", limit?: 20, focus?: "all"|"site" }
//   → pulls the shops from Google Places (New), opens each website, grades it,
//     scores every shop with the Prospector's rules, writes a spoken opener, and returns
//     the list ranked best-call-first with an estimated $/mo on the table.
//
// Only HQ admins can call it (the caller's JWT is checked against is_hq_admin()).
// Needs GOOGLE_PLACES_KEY — as an edge-function secret or in rx_config (HQ can save it there).
// Nothing here contacts anyone. Everything read is public: their listing, their own site.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const REST = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

let CFG: Record<string, string> = {};
async function loadConfig() {
  if (Object.keys(CFG).length) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rx_config?select=key,value`, { headers: REST });
    if (r.ok) for (const row of await r.json()) CFG[row.key] = row.value;
  } catch (e) { console.error("rx_config load failed", e); }
}
const cfg = (k: string) => Deno.env.get(k) || CFG[k] || "";

// Average ticket by trade — sizes the "$ on the table" number. Same conservative figures as lsa-intake.
const TICKET: Record<string, number> = { plumbing: 425, hvac: 650, electrical: 380, roofing: 1200, other: 400 };
const TRADE_WORDS: Record<string, string> = { plumb: "plumbing", hvac: "hvac", heating: "hvac", cooling: "hvac", "air cond": "hvac", electric: "electrical", roof: "roofing" };
function tradeOf(q: string) { const s = q.toLowerCase(); for (const k in TRADE_WORDS) if (s.includes(k)) return TRADE_WORDS[k]; return "other"; }

type Place = {
  id: string; displayName?: { text: string }; formattedAddress?: string; nationalPhoneNumber?: string;
  rating?: number; userRatingCount?: number; websiteUri?: string; types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
};

async function searchPlaces(key: string, text: string, limit: number): Promise<Place[]> {
  const out: Place[] = []; let pageToken: string | undefined;
  for (let i = 0; i < 3 && out.length < limit; i++) {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.regularOpeningHours,places.websiteUri,places.types,nextPageToken" },
      body: JSON.stringify({ textQuery: text, pageSize: 20, languageCode: "en", regionCode: "US", ...(pageToken ? { pageToken } : {}) }),
    });
    if (!r.ok) throw new Error(`Google Places ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    out.push(...(j.places || []));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out.slice(0, limit);
}

// ---- website grade ----
// Two fetches max (home page, then a contact/about/book page if linked). Six seconds each.
type SiteGrade = {
  exists: boolean; url?: string; https?: boolean; reachable?: boolean; mobile_ok?: boolean; booking?: boolean;
  has_hours?: boolean; seo_ok?: boolean; stale?: boolean; copyright_year?: number | null; builder?: string | null;
  after_hours?: boolean; owner_name?: string | null; email?: string | null; note?: string; gaps: string[];
};
async function get(url: string, ms = 6000): Promise<{ ok: boolean; status: number; html: string; finalUrl: string }> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", Accept: "text/html,*/*" } });
    const html = (await r.text()).slice(0, 400_000);
    return { ok: r.ok, status: r.status, html, finalUrl: r.url || url };
  } catch { return { ok: false, status: 0, html: "", finalUrl: url }; }
  finally { clearTimeout(t); }
}
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function gradeSite(url?: string): Promise<SiteGrade> {
  if (!url) return { exists: false, gaps: ["no website"] };
  const g: SiteGrade = { exists: true, url, gaps: [] };
  const home = await get(url);
  g.reachable = home.ok && home.html.length > 200;
  g.https = g.reachable ? (home.finalUrl || url).startsWith("https://") : undefined;
  if (!g.reachable) { g.gaps.push(home.status === 0 ? "site down" : `site error ${home.status}`); g.note = "site did not load"; return g; }
  let html = home.html;
  const text0 = strip(html).toLowerCase();
  // second page: contact / about / book
  const link = (html.match(/href=["']([^"']*(?:contact|about|book|schedule|appointment)[^"']*)["']/i) || [])[1];
  if (link && !/^(mailto|tel|javascript|#)/i.test(link)) {
    try { const u = new URL(link, home.finalUrl).href; if (new URL(u).host === new URL(home.finalUrl).host) { const p = await get(u); if (p.ok) html += "\n" + p.html; } } catch { /* ignore */ }
  }
  const text = strip(html).toLowerCase();
  g.mobile_ok = /<meta[^>]+name=["']viewport["']/i.test(html);
  g.booking = /(book (now|online|an? appointment)|schedule (now|online|service)|request (service|an? appointment|a quote)|online booking|calendly|housecall|jobber|servicetitan|acuity|<form)/i.test(html);
  g.has_hours = /(mon(day)?|tue|wed|thu|fri|sat(urday)?|sun(day)?)[^.]{0,40}\d{1,2}(:\d{2})?\s?(am|pm)/i.test(text) || /hours/.test(text) && /\d\s?(am|pm)/.test(text);
  g.after_hours = /(24\/7|24 hours|emergency|after[- ]hours)/.test(text);
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || "";
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html);
  g.seo_ok = title.length > 10 && desc;
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(m => +m[1]);
  g.copyright_year = years.length ? Math.max(...years) : null;
  const nowY = new Date().getFullYear();
  g.stale = (g.copyright_year != null && g.copyright_year <= nowY - 3) || /<table[^>]+(width|cellpadding)=/i.test(home.html) || /<font\b/i.test(home.html);
  g.builder = /wix\.com|_wix/i.test(html) ? "Wix" : /squarespace/i.test(html) ? "Squarespace" : /wp-content/i.test(html) ? "WordPress" : /godaddy|websitebuilder/i.test(html) ? "GoDaddy" : /weebly/i.test(html) ? "Weebly" : null;
  const em = html.match(/\b[a-z0-9._%+-]+@(?!(?:example|sentry|wixpress|googleapis))[a-z0-9.-]+\.[a-z]{2,}\b/i);
  g.email = em && !/\.(png|jpg|svg|gif|css|js)$/i.test(em[0]) ? em[0] : null;
  const own = text0.match(/(?:owner|founder|proprietor)[,:\s-]+([a-z][a-z'.-]+ [a-z][a-z'.-]+)/i) || text0.match(/([a-z][a-z'.-]+ [a-z][a-z'.-]+)[,\s-]+(?:owner|founder)/i);
  g.owner_name = own ? own[1].replace(/\b\w/g, c => c.toUpperCase()) : null;

  if (!g.https) g.gaps.push("no SSL");
  if (!g.mobile_ok) g.gaps.push("breaks on mobile");
  if (!g.booking) g.gaps.push("no online booking");
  if (!g.seo_ok) g.gaps.push("no SEO basics");
  if (g.stale) g.gaps.push(g.copyright_year ? `site last touched ${g.copyright_year}` : "outdated site");
  if (!g.has_hours) g.gaps.push("no hours on site");
  g.note = [g.builder ? `built on ${g.builder}` : null, g.copyright_year ? `© ${g.copyright_year}` : null].filter(Boolean).join(", ");
  return g;
}

// ---- listing signals + score (the Prospector's rules, plus what the website told us) ----
function hoursOf(p: Place) {
  const d = p.regularOpeningHours?.weekdayDescriptions;
  if (!d || !d.length) return { listed: false, closed_weekends: false, open_24h: false, note: "no hours listed" };
  const sat = d.find(x => /^saturday/i.test(x)) || "", sun = d.find(x => /^sunday/i.test(x)) || "";
  const closed_weekends = /closed/i.test(sat) && /closed/i.test(sun);
  const open_24h = d.every(x => /open 24 hours/i.test(x));
  const note = open_24h ? "open 24 hours" : closed_weekends ? "closed weekends" : /closed/i.test(sat) || /closed/i.test(sun) ? "closed one weekend day" : "open weekends";
  return { listed: true, closed_weekends, open_24h, note };
}

function score(p: Place, h: ReturnType<typeof hoursOf>, s: SiteGrade) {
  const n = p.userRatingCount ?? 0, r = p.rating ?? 0;
  let sc = 20;
  if (n >= 10 && n <= 150) sc += 25;
  if (h.closed_weekends) sc += 30;
  if (!h.listed) sc += 15;
  if (r >= 4.7) sc += 10;
  if (h.open_24h) sc -= 20;
  if (n >= 500) sc -= 20;
  if (n < 10) sc -= 10;
  if (!s.exists) sc += 20;
  else { if (!s.booking) sc += 5; if (s.mobile_ok === false) sc += 10; if (s.https === false) sc += 5; if (s.stale) sc += 10; if (s.reachable === false) sc += 15; }
  return Math.max(0, Math.min(100, sc));
}

// $ on the table per month. Deliberately rough and labelled as an estimate in HQ:
// calls/week grows with review count; the share that goes unanswered is higher for shops
// that are closed weekends or list no hours; 35% of answered calls become a paid ticket.
function value(trade: string, p: Place, h: ReturnType<typeof hoursOf>, s: SiteGrade) {
  const n = p.userRatingCount ?? 0;
  const callsWk = Math.min(40, 6 + n * 0.15);
  let missed = 0.3; if (h.closed_weekends || !h.listed) missed = 0.45; if (h.open_24h) missed = 0.15;
  const jobs = callsWk * 4.33 * missed * 0.35;
  const web = !s.exists ? 2 : (!s.booking ? 1 : 0) + (s.mobile_ok === false ? 1 : 0);
  const ticket = TICKET[trade] || TICKET.other;
  return { jobs_mo: Math.round(jobs + web), dollars_mo: Math.round((jobs + web) * ticket), ticket };
}

const stars = (p: Place) => p.rating ? `${Number(p.rating).toFixed(1).replace(/\.0$/, "")} stars` : "";
function opener(p: Place, h: ReturnType<typeof hoursOf>, s: SiteGrade) {
  const n = p.userRatingCount ?? 0;
  if (!s.exists) return `I looked you up on Google — ${n} reviews${p.rating ? ` at ${stars(p)}` : ""} and no website at all, so every one of those people has to call and hope somebody picks up. What happens to the call when you're on a job?`;
  if (s.reachable === false) return `Your website isn't loading right now — Google still sends people there, and they're landing on an error page. Did you know it was down?`;
  if (h.closed_weekends && s.after_hours) return `Your site says you take emergencies, but your Google listing says you're closed Saturday and Sunday — which one does a customer believe at 9pm Friday?`;
  if (h.closed_weekends) return `Your Google listing says you're closed Saturday and Sunday, so a water heater that goes on a Friday night is somebody else's job by Monday. Who picks up the phone on a weekend right now?`;
  if (!h.listed) return `Your Google listing has no hours on it at all — people can't tell if you're open, so they call the next guy. Is that on purpose, or did nobody ever fill it in?`;
  if (s.mobile_ok === false) return `I opened your site on my phone and it doesn't fit the screen — and that's where nearly every emergency call starts. When did it last get touched?`;
  if (!s.booking) return `You're at ${stars(p) || "a good rating"} with ${n} reviews, but there's no way to book on your site — it's call or nothing. What happens to that call while you're under a sink?`;
  if (s.stale && s.copyright_year) return `Your website still says ${s.copyright_year} at the bottom — a customer reads that as "are they still in business?". Is it still booking you work?`;
  return `You're at ${stars(p) || "a good rating"} with ${n} reviews — a real shop, owner-run. What happens to a call that comes in while you're on a job?`;
}
// none | down | old | weak | ok — one word HQ can filter on.
function siteStatus(s: SiteGrade): "none" | "down" | "old" | "weak" | "ok" {
  if (!s.exists) return "none";
  if (s.reachable === false) return "down";
  if (s.stale || s.mobile_ok === false || s.https === false) return "old";
  if (!s.booking || !s.seo_ok) return "weak";
  return "ok";
}
function pitch(h: ReturnType<typeof hoursOf>, s: SiteGrade, p: Place) {
  const n = p.userRatingCount ?? 0, r = p.rating ?? 0;
  const siteGap = ["none", "down", "old"].includes(siteStatus(s));
  const phoneGap = h.closed_weekends || !h.listed;
  const reviewGap = n < 10 || (r > 0 && r < 4.5 && n >= 10);
  // The site is the easiest yes: it's visible, it's theirs, and they already know it's bad.
  if (siteGap && phoneGap) return "Job-Ready Website + Never Miss a Call";
  if (siteGap) return "Job-Ready Website";
  if (phoneGap && reviewGap) return "Never Miss a Call + Review Engine";
  if (reviewGap) return "Review Engine";
  return "Never Miss a Call";
}

function zipOf(addr?: string) { return (addr?.match(/\b(\d{5})(?:-\d{4})?\b/) || [])[1] || null; }
function cityOf(addr: string | undefined, fallback: string) {
  const m = addr?.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/); return m ? m[1].trim() : fallback.split(",")[0].trim();
}

async function isAdmin(auth: string | null): Promise<boolean> {
  if (!auth) return false;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/is_hq_admin`, { method: "POST", headers: { apikey: ANON, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return Response.json({ ok: false, error: "POST only" }, { status: 405, headers: CORS });
  if (!(await isAdmin(req.headers.get("authorization")))) return Response.json({ ok: false, error: "not admin" }, { status: 403, headers: CORS });
  let b: any; try { b = await req.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400, headers: CORS }); }
  const tradeQ = String(b.trade || "").trim().slice(0, 60), city = String(b.city || "").trim().slice(0, 80);
  if (!tradeQ || !city) return Response.json({ ok: false, error: "trade and city are required" }, { status: 400, headers: CORS });
  // focus = "site": go wider (40 listings) and keep only shops with no site, a dead one, or an old one.
  const focus = b.focus === "site" ? "site" : "all";
  const limit = focus === "site" ? 40 : Math.max(5, Math.min(40, Number(b.limit) || 20));

  await loadConfig();
  const key = cfg("GOOGLE_PLACES_KEY");
  if (!key) return Response.json({ ok: false, error: "no_key", message: "Google Places key missing. Save it in HQ → Finder." }, { status: 200, headers: CORS });

  const t0 = Date.now();
  let places: Place[];
  try { places = await searchPlaces(key, `${tradeQ} ${city}`, limit); }
  catch (e) { return Response.json({ ok: false, error: String((e as Error).message) }, { status: 200, headers: CORS }); }
  const trade = tradeOf(tradeQ);

  // grade every site in parallel; the slowest one bounds the request, not the sum
  let rows = await Promise.all(places.map(async p => {
    const h = hoursOf(p), s = await gradeSite(p.websiteUri);
    const sc = score(p, h, s), v = value(trade, p, h, s);
    const signals = { closed_weekends: h.closed_weekends, no_hours_listed: !h.listed, open_24h: h.open_24h, no_website: !s.exists, no_booking: s.exists && !s.booking, mobile_broken: s.mobile_ok === false, stale_site: !!s.stale, no_ssl: s.https === false };
    return {
      name: p.displayName?.text || "(unnamed)", trade, phone: p.nationalPhoneNumber || null, website: p.websiteUri || null,
      address: p.formattedAddress || null, city: cityOf(p.formattedAddress, city), zip: zipOf(p.formattedAddress),
      rating: p.rating ?? null, reviews: p.userRatingCount ?? 0, hours_note: h.note, google_place_id: p.id,
      signals, score: sc, why: opener(p, h, s), pitch: pitch(h, s, p), site_status: siteStatus(s),
      owner_name: s.owner_name || null, email: s.email || null,
      value: v,
      gaps: [...(h.closed_weekends ? ["closed weekends"] : []), ...(!h.listed ? ["no hours on Google"] : []), ...(h.open_24h ? ["says open 24h"] : []), ...s.gaps],
      audit: { site: s, gmb: { hours_listed: h.listed, hours: h.note, reviews: p.userRatingCount ?? 0, rating: p.rating ?? null }, gaps: s.gaps, note: `Finder scan ${new Date().toISOString().slice(0, 10)} — ${tradeQ} in ${city}` },
    };
  }));
  const scanned = rows.length;
  if (focus === "site") rows = rows.filter(r => ["none", "down", "old"].includes(r.site_status));
  rows.sort((a, b) => b.score - a.score || b.value.dollars_mo - a.value.dollars_mo);
  const total = rows.reduce((s, r) => s + r.value.dollars_mo, 0);
  return Response.json({ ok: true, trade, city, query: `${tradeQ} ${city}`, focus, scanned, found: rows.length, quality: rows.filter(r => r.score >= 50).length,
    sites: { none: rows.filter(r => r.site_status === "none").length, down: rows.filter(r => r.site_status === "down").length, old: rows.filter(r => r.site_status === "old").length, weak: rows.filter(r => r.site_status === "weak").length },
    avg_value_mo: rows.length ? Math.round(total / rows.length) : 0, total_value_mo: total, ms: Date.now() - t0, rows }, { headers: CORS });
});
