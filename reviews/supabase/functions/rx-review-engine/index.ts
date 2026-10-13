import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// rx-review-engine — the Review Engine sender. Fired by pg_cron (reviews/supabase/001_rx_review_engine.sql).
//
//   {"mode":"send"}      every 10 min: text every rx_review_requests row that is due (first ask 2h after
//                        the job, one reminder on day 3 if the link was never tapped, then never again)
//   {"mode":"snapshot"}  daily: pull each shop's Google rating + review count (needs google_place_id and
//                        GOOGLE_PLACES_KEY) into rx_review_snapshots so the counts mean something
//   {"mode":"weekly"}    Friday evening: one text to each owner with the week's numbers
//
// The gate lives in SQL (rx_review_due): the engine must be on, the shop active, a link must exist, and the
// number must not have said STOP. A number with no consent record at all is only texted when the source
// attested consent (receptionist "[sms consent: yes]", the owner's own button / import, a field-app webhook).
// Every send is logged on the row; every skip says why in plain words. Auth: x-rx-sync-secret (RX_SYNC_SECRET).
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const db = async <T>(path: string, init: RequestInit = {}) => { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers || {}) } }); if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`); const t = await r.text(); return (t ? JSON.parse(t) : null) as T; };
const rpc = <T>(fn: string, args: Record<string, unknown> = {}) => db<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

let CFG: Record<string, string> = {};
async function loadCfg() { try { const rows = await db<{ key: string; value: string }[]>("rx_config?select=key,value"); for (const r of rows || []) CFG[r.key] = r.value; } catch (e) { console.error("rx_config", e); } }
const cfg = (k: string) => Deno.env.get(k) || CFG[k] || "";

async function sms(to: string, body: string): Promise<string | null> {
  const sid = cfg("TWILIO_ACCOUNT_SID"), from = cfg("TWILIO_FROM");
  const user = cfg("TWILIO_API_KEY") || sid, pass = cfg("TWILIO_API_SECRET") || cfg("TWILIO_AUTH_TOKEN");
  if (!sid || !user || !pass || !from) return "sms not configured";
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${user}:${pass}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!r.ok) return `twilio ${r.status} ${(await r.text()).slice(0, 200)}`;
  return null;
}

type Due = { id: string; business_id: string; business: string; timezone: string; customer_name: string | null; phone: string; token: string; touches: number; link: string | null; allowed: boolean; opted_out: boolean };

// 2h after a 4pm job is 6pm: fine. 2h after an 8pm job is 10pm: not fine. Anything outside 9am-8pm local waits for 9am.
function quietHoursUntil(tz: string): Date | null {
  const now = new Date();
  let hour = now.getUTCHours();
  try { hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz || "America/New_York" }).format(now)) % 24; } catch { /* bad tz: use UTC */ }
  if (hour >= 9 && hour < 20) return null;
  const wait = hour >= 20 ? 24 - hour + 9 : 9 - hour;
  const at = new Date(now); at.setUTCMinutes(0, 0, 0); at.setUTCHours(at.getUTCHours() + wait);
  return at;
}

function message(d: Due, link: string): string {
  const first = String(d.customer_name || "").trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first}, ` : "";
  if (d.touches === 0) return `${hi}thanks for having ${d.business} out. If we did right by you, a quick Google review helps a small shop more than you'd think: ${link}  Reply here if anything's not right. Reply STOP to opt out.`;
  return `${hi}${d.business} here, one more time and then we'll leave you be. If you've got 30 seconds, a Google review would mean a lot: ${link}  Reply STOP to opt out.`;
}

async function send() {
  const base = (cfg("REVIEW_LINK_BASE") || "https://tbsol.net/r/").replace(/\/?$/, "/");
  const due = await rpc<Due[]>("rx_review_due", { p_limit: 50 });
  const out = { due: due.length, sent: 0, deferred: 0, skipped: 0, stopped: 0, failed: 0 };
  for (const d of due) {
    const mark = (status: string, note: string | null = null, next: Date | null = null) =>
      rpc("rx_review_mark", { p_id: d.id, p_status: status, p_note: note, p_next: next ? next.toISOString() : null }).catch((e) => console.error("mark", d.id, e));
    if (d.opted_out) { await mark("stopped", "This number texted STOP. It will never be asked."); out.stopped++; continue; }
    if (!d.link) { await mark("defer", "No Google review link or Place ID on the shop yet. Waiting a day.", new Date(Date.now() + 864e5)); out.deferred++; continue; }
    if (!d.allowed) { await mark("skipped", "No text permission on record for this number."); out.skipped++; continue; }
    const quiet = quietHoursUntil(d.timezone);
    if (quiet) { await mark("defer", "Outside 9am to 8pm. Waiting for the morning.", quiet); out.deferred++; continue; }
    const err = await sms(d.phone, message(d, base + d.token));
    if (err) {
      // Twilio 21610 = recipient blocked us (they texted STOP to the carrier). Honour it like a STOP.
      if (/21610/.test(err)) { await rpc("rx_review_inbound", { p_from: d.phone, p_body: "STOP", p_source: "twilio-21610" }).catch(() => {}); await mark("stopped", "Carrier says this number blocked us."); out.stopped++; continue; }
      await mark("failed", err); out.failed++; continue;
    }
    await mark("sent"); out.sent++;
  }
  return out;
}

async function snapshot() {
  const key = cfg("GOOGLE_PLACES_KEY");
  const shops = await db<{ id: string; google_place_id: string }[]>("rx_businesses?review_engine=is.true&active=is.true&google_place_id=not.is.null&select=id,google_place_id");
  const out = { shops: shops.length, saved: 0, failed: 0, note: key ? undefined : "GOOGLE_PLACES_KEY not set: counts stay empty" };
  if (!key) return out;
  for (const s of shops) {
    try {
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(s.google_place_id)}`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount" } });
      if (!r.ok) throw new Error(`places ${r.status}`);
      const j = await r.json();
      await rpc("rx_review_snapshot_save", { p_business: s.id, p_rating: j.rating ?? null, p_count: j.userRatingCount ?? null });
      out.saved++;
    } catch (e) { console.error("snapshot", s.id, e); out.failed++; }
  }
  return out;
}

async function weekly() {
  type Row = { business_id: string; business: string; owner_phone: string; asked: number; clicked: number; rating: number | null; count: number | null; gained: number | null };
  const rows = await rpc<Row[]>("rx_review_weekly_digest");
  const out = { owners: rows.length, texted: 0, failed: 0 };
  for (const r of rows) {
    const google = r.count != null ? ` Google shows ${r.count} reviews${r.rating != null ? ` at ${r.rating}` : ""}${r.gained ? ` (${r.gained > 0 ? "+" : ""}${r.gained} this week)` : ""}.` : "";
    const body = `${r.business} reviews this week: ${r.asked} customer${r.asked === 1 ? "" : "s"} asked, ${r.clicked} tapped the link.${google} Full list: tbsol.net/receptionist/app/`;
    const err = await sms(r.owner_phone, body);
    if (err) { console.error("weekly", r.business_id, err); out.failed++; } else out.texted++;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  await loadCfg();
  const SECRET = cfg("RX_SYNC_SECRET");
  if (SECRET && req.headers.get("x-rx-sync-secret") !== SECRET) return new Response("nope", { status: 401 });
  let mode = "send";
  try { const b = await req.json(); if (b?.mode) mode = String(b.mode); } catch { /* empty body = send */ }
  try {
    const result = mode === "snapshot" ? await snapshot() : mode === "weekly" ? await weekly() : await send();
    return Response.json({ ok: true, mode, ...result });
  } catch (e) {
    console.error("rx-review-engine", mode, e);
    return Response.json({ ok: false, mode, error: String(e).slice(0, 500) }, { status: 500 });
  }
});
