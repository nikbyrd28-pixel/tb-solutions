import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// rx-review — the Review agent. Runs hourly from pg_cron (see hq/supabase/006_hq_agents.sql).
// For every receptionist job marked `done` in the last 14 days with no row in rx_review_asks yet:
//   - customer agreed to texts on the call (rx_sms_optins.service_texts for that phone)  → else skip 'no_consent'
//   - the shop has a review_url set in HQ → Edit brain                                   → else skip 'no_review_url'
//   - the job has a phone                                                                → else skip 'no_phone'
// then texts the customer ONE review ask and logs it. One row per job, ever — the unique index makes
// a second send impossible even if two runs overlap. Every skip is logged with its reason so HQ can
// show "3 jobs waiting on a review link" instead of a green light that means nothing.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const db = async <T>(path: string, init: RequestInit = {}) => { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers || {}) } }); if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`); const t = await r.text(); return (t ? JSON.parse(t) : null) as T; };

let CFG: Record<string, string> = {};
async function loadCfg() { try { const rows = await db<any[]>("rx_config?select=key,value"); for (const r of rows || []) CFG[r.key] = r.value; } catch (e) { console.error("rx_config", e); } }
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  await loadCfg();
  const SECRET = cfg("RX_SYNC_SECRET");
  if (SECRET && req.headers.get("x-rx-sync-secret") !== SECRET) return new Response("nope", { status: 401 });

  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const jobs = await db<any[]>(`rx_jobs?status=eq.done&updated_at=gte.${since}&select=id,business_id,customer_name,customer_phone,issue,notes&order=updated_at.asc&limit=50`);
  const askedRows = jobs.length ? await db<any[]>(`rx_review_asks?job_id=in.(${jobs.map(j => j.id).join(",")})&select=job_id`) : [];
  const asked = new Set(askedRows.map(a => a.job_id));
  const out = { sent: 0, skipped: 0, failed: 0 } as Record<string, number>;

  for (const j of jobs) {
    if (asked.has(j.id)) continue;
    const log = async (status: string, reason: string | null) => {
      try { await db("rx_review_asks", { method: "POST", body: JSON.stringify({ job_id: j.id, business_id: j.business_id, phone: j.customer_phone || null, status, reason }) }); out[status]++; }
      catch (e) { console.error("log", e); } // unique(job_id) → a parallel run already handled it
    };
    const phone = String(j.customer_phone || "").trim();
    if (!phone) { await log("skipped", "no_phone"); continue; }
    const biz = (await db<any[]>(`rx_businesses?id=eq.${j.business_id}&select=name,review_url,active`))[0];
    if (!biz?.review_url) { await log("skipped", "no_review_url"); continue; }
    const optin = await db<any[]>(`rx_sms_optins?phone=eq.${encodeURIComponent(phone)}&service_texts=is.true&limit=1`).catch(() => []);
    const consented = optin.length > 0 || /\[sms consent: yes\]/.test(j.notes || "");
    if (!consented) { await log("skipped", "no_consent"); continue; }
    const first = String(j.customer_name || "").trim().split(/\s+/)[0];
    const msg = `${first ? `Hi ${first}, ` : ""}thanks for calling ${biz.name}${j.issue ? ` about the ${String(j.issue).toLowerCase().replace(/\.$/, "")}` : ""}. If we did right by you, a quick Google review helps a small shop more than you'd think: ${biz.review_url}  Reply STOP to opt out.`;
    const err = await sms(phone, msg);
    await log(err ? "failed" : "sent", err);
  }
  return Response.json({ ok: true, checked: jobs.length, ...out });
});
