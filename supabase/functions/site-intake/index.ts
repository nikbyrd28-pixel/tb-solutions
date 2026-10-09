import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Site intake — every lead form on tbsol.net (home, websites, receptionist, reviews, planner, leads, rank, for/*, services/*)
// posts here via /lead.js. Saves to `intakes` (already in the HQ pipeline), texts Nick, texts the prospect back.
// Secrets (same as lsa-intake): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (or TWILIO_API_KEY/SECRET), TWILIO_FROM, NICK_PHONE.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const cfg = (k: string) => Deno.env.get(k) || "";

const OFFERS: Record<string, string> = {
  websites: "Job-Ready Website", receptionist: "Never Miss a Call", reviews: "Review Engine", planner: "Remodel Planner",
  leads: "Lead Engine", rank: "Google Rank Fix", bundle: "Full Front Office", general: "Not sure yet",
};

function phoneE164(s: string): string | null { const d = String(s || "").replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d[0] === "1" ? `+${d}` : null; }
const S = (v: unknown, n = 200) => v == null || v === "" ? null : String(v).slice(0, n).trim();

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
  if (b._honey) return Response.json({ ok: true }, { headers: CORS }); // bot filled the hidden field

  const phone = phoneE164(b.phone);
  if (!phone) return Response.json({ ok: false, error: "Enter a 10-digit US cell number so Nick can text you." }, { status: 400, headers: CORS });
  const name = S(b.name, 120);
  if (!name) return Response.json({ ok: false, error: "What should Nick call you?" }, { status: 400, headers: CORS });

  const offerKey = (S(b.offer, 30) || "general").toLowerCase();
  const offer = OFFERS[offerKey] || S(b.offer, 60) || "Not sure yet";
  const page = S(b.page, 120);
  const row = {
    name, phone, business: S(b.business, 120), email: S(b.email, 160), website: S(b.website, 200),
    interest: offer, goal: S(b.goal, 500), about: S(b.trade, 40),
    ref: [page, S(b.utm, 200)].filter(Boolean).join(" "),
    status: "new", notes: null,
  };
  const r = await fetch(`${SB_URL}/rest/v1/intakes`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok) { console.error("insert", r.status, await r.text()); return Response.json({ ok: false, error: "Couldn't save that. Text Nick directly at (484) 841-8501." }, { status: 500, headers: CORS }); }

  const nick = cfg("NICK_PHONE");
  if (nick) {
    await sms(nick, `LEAD — ${offer}\n${name}${row.business ? " · " + row.business : ""}${row.about ? " · " + row.about : ""}\n${phone}\n${row.goal || "(no note)"}\nfrom ${page || "tbsol.net"}`);
    await sms(phone, `Hey ${name.split(" ")[0]}, Nick at TB Solutions. Got your note about the ${offer}. I'll text you back within the hour with a quick plan and what it'd cost. Reply STOP to opt out.`);
  }
  return Response.json({ ok: true }, { headers: CORS });
});
