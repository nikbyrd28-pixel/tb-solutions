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
  leads: "Google Guaranteed Setup", rank: "Google Rank Fix", bundle: "The Works", general: "Not sure yet",
};

// Canonical consent wording (mirrors lead.js). Stored server-side so the record can't be spoofed by a crafted POST.
const SMS_CONSENT_TEXT = "Yes, text me. By checking this box I agree to receive text messages from TB Solutions at the number above about my request. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent is not required to buy anything; leave it unchecked and Nick will call instead.";
const AGE_TERMS_TEXT = "I am 18 years of age or older and I agree to the Terms of service and privacy policy.";
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

  const rawPhone = S(b.phone, 40);
  const phone = rawPhone ? phoneE164(rawPhone) : null;
  if (rawPhone && !phone) return Response.json({ ok: false, error: "That cell number needs 10 digits." }, { status: 400, headers: CORS });
  const email = S(b.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ ok: false, error: "That email doesn't look right." }, { status: 400, headers: CORS });
  if (!phone && !email) return Response.json({ ok: false, error: "Leave a cell number or an email so Nick can reach you." }, { status: 400, headers: CORS });
  const name = S(b.name, 120);
  if (!name) return Response.json({ ok: false, error: "What should Nick call you?" }, { status: 400, headers: CORS });
  const ageTerms = b.age_terms === true || b.age_terms === "1" || b.age_terms === "true";
  if (!ageTerms) return Response.json({ ok: false, error: "Please confirm you're 18 or older and agree to the terms." }, { status: 400, headers: CORS });

  const offerKey = (S(b.offer, 30) || "general").toLowerCase();
  const offer = OFFERS[offerKey] || S(b.offer, 60) || "Not sure yet";
  const page = S(b.page, 120);
  const consent = !!phone && (b.sms_consent === true || b.sms_consent === "1" || b.sms_consent === "true"); // SMS consent is meaningless without a number
  const row = {
    name, phone, business: S(b.business, 120), email, website: S(b.website, 200),
    interest: offer, goal: S(b.goal, 500), about: S(b.trade, 40),
    ref: [page, S(b.utm, 200)].filter(Boolean).join(" "),
    status: "new", notes: consent ? null : phone ? "No SMS consent: CALL, don't text." : "No phone given: EMAIL only.",
    sms_consent: consent, sms_consent_at: consent ? new Date().toISOString() : null, sms_consent_text: consent ? SMS_CONSENT_TEXT : null,
    age_terms: ageTerms, age_terms_at: new Date().toISOString(), age_terms_text: AGE_TERMS_TEXT,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] || null, user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
  };
  const r = await fetch(`${SB_URL}/rest/v1/intakes`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) });
  if (!r.ok) { console.error("insert", r.status, await r.text()); return Response.json({ ok: false, error: "Couldn't save that. Call Nick at (484) 841-8501." }, { status: 500, headers: CORS }); }

  const nick = cfg("NICK_PHONE");
  if (nick) {
    await sms(nick, `JOB REQUEST — ${offer}\n${name}${row.business ? " · " + row.business : ""}${row.about ? " · " + row.about : ""}\n${phone || email}${!phone ? "  (NO PHONE: EMAIL)" : consent ? "" : "  (NO SMS CONSENT: CALL)"}\n${row.goal || "(no note)"}\nfrom ${page || "tbsol.net"}`);
    // Only text the prospect if they checked the consent box (Twilio toll-free / TCPA). Otherwise Nick calls.
    if (consent && phone) await sms(phone, `TB Solutions: Hey ${name.split(" ")[0]}, Nick here. Got your note about the ${offer}. I'll text you within the hour with what I'd do and what it costs. Msg&data rates may apply. Reply STOP to opt out, HELP for help.`);
  }
  return Response.json({ ok: true }, { headers: CORS });
});
