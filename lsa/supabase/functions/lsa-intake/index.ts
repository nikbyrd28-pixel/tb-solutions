import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// LSA Shield intake — tbsol.net/lsa/ posts the calculator + contact form here.
// Computes what the new LSA rules cost the shop, saves the row, texts Nick, returns the numbers.
// Secrets (optional): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (or TWILIO_API_KEY/SECRET), TWILIO_FROM, NICK_PHONE.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const cfg = (k: string) => Deno.env.get(k) || "";

// Average ticket by trade — used only to size the "lost jobs" number. Conservative.
const TICKET: Record<string, number> = { plumbing: 425, hvac: 650, electrical: 380, roofing: 1200, other: 400 };
const BOOK_RATE = 0.35; // share of answered LSA calls that turn into a paid job

export function estimate(i: { trade?: string; lead_cost?: number; calls_per_week?: number; missed_pct?: number }) {
  const trade = (i.trade || "other").toLowerCase();
  const leadCost = clamp(i.lead_cost ?? 45, 5, 500);
  const callsWk = clamp(i.calls_per_week ?? 10, 0, 500);
  const missed = clamp(i.missed_pct ?? 30, 0, 100) / 100;
  const missedMo = callsWk * 4.33 * missed;
  // New rule (Oct 1 2026): a missed call where the caller holds ~20s+ is billable. Assume 60% of ring-outs qualify.
  const missedCharges = missedMo * 0.6 * leadCost;
  const lostJobs = missedMo * BOOK_RATE * (TICKET[trade] || TICKET.other);
  const r = (n: number) => Math.round(n);
  return { est_missed_calls_mo: r(missedMo), est_missed_charges_mo: r(missedCharges), est_lost_jobs_mo: r(lostJobs), est_total_mo: r(missedCharges + lostJobs) };
}
function clamp(n: number, lo: number, hi: number) { n = Number(n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }
function phoneE164(s: string): string | null { const d = String(s || "").replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d[0] === "1" ? `+${d}` : null; }
const S = (v: unknown, n = 160) => v == null || v === "" ? null : String(v).slice(0, n);
const N = (v: unknown) => v == null || v === "" ? null : Math.round(Number(v)) || 0;

async function sms(to: string, body: string): Promise<boolean> {
  const sid = cfg("TWILIO_ACCOUNT_SID"), from = cfg("TWILIO_FROM");
  const user = cfg("TWILIO_API_KEY") || sid, pass = cfg("TWILIO_API_SECRET") || cfg("TWILIO_AUTH_TOKEN");
  if (!sid || !user || !pass || !from || !to) { console.log("[sms disabled]", to, body); return false; }
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST", headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }) });
  if (!r.ok) { console.error("twilio", r.status, await r.text()); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  let b: any; try { b = await req.json(); } catch { return new Response("bad json", { status: 400, headers: CORS }); }
  if (b._honey) return Response.json({ ok: true }, { headers: CORS }); // bot

  const est = estimate({ trade: b.trade, lead_cost: N(b.lead_cost) ?? undefined, calls_per_week: N(b.calls_per_week) ?? undefined, missed_pct: N(b.missed_pct) ?? undefined });
  // mode "calc" = just numbers, nothing saved; mode "audit" = save + alert
  if (b.mode === "calc") return Response.json({ ok: true, ...est }, { headers: CORS });

  const phone = phoneE164(b.phone);
  if (!phone) return Response.json({ ok: false, error: "Enter a 10-digit US phone number so Nick can text you the audit." }, { status: 400, headers: CORS });

  const row = {
    business: S(b.business), name: S(b.name, 120), phone, email: S(b.email), trade: S(b.trade, 30), city: S(b.city, 80),
    lsa_status: S(b.lsa_status, 30), monthly_spend: N(b.monthly_spend), lead_cost: N(b.lead_cost), calls_per_week: N(b.calls_per_week), missed_pct: N(b.missed_pct),
    ...est, source: "web", utm: S(b.utm, 200),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] || null, user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
  };
  const r = await fetch(`${SB_URL}/rest/v1/lsa_leads`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok) { console.error("insert", r.status, await r.text()); return Response.json({ ok: false, error: "Could not save right now. Text Nick directly." }, { status: 500, headers: CORS }); }

  const nick = cfg("NICK_PHONE");
  if (nick) {
    await sms(nick, `LSA AUDIT — ${row.business || "?"} (${row.trade || "?"}${row.city ? ", " + row.city : ""})\n${row.name || ""} ${phone}\nLSA: ${row.lsa_status || "?"} · $${row.monthly_spend ?? "?"}/mo · ${row.calls_per_week ?? "?"} calls/wk · ${row.missed_pct ?? "?"}% missed\nEst bleed: $${est.est_total_mo}/mo ($${est.est_missed_charges_mo} Google + $${est.est_lost_jobs_mo} jobs)`);
    await sms(phone, `Hey ${row.name?.split(" ")[0] || "there"}, Nick at TB Solutions. Got your LSA numbers — roughly $${est.est_total_mo}/mo walking out under the new rules. I'll text you the audit today. Reply STOP to opt out.`);
  }
  return Response.json({ ok: true, ...est }, { headers: CORS });
});
