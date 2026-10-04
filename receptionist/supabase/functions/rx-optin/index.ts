import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Records SMS opt-in consent from tbsol.net/receptionist/sms-consent/ (web form).
// Each checkbox is a separate, optional consent. Nothing else happens here.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  let b: any; try { b = await req.json(); } catch { return new Response("bad json", { status: 400, headers: CORS }); }
  const d = String(b.phone || "").replace(/\D/g, "");
  const phone = d.length === 10 ? `+1${d}` : d.length === 11 && d[0] === "1" ? `+${d}` : null;
  if (!phone) return Response.json({ ok: false, error: "Enter a 10-digit US mobile number." }, { status: 400, headers: CORS });
  if (!b.service_texts && !b.promo_texts) return Response.json({ ok: false, error: "Pick at least one type of text to receive, or just close this page — texting is optional." }, { status: 400, headers: CORS });
  const row = { phone, name: b.name ? String(b.name).slice(0, 120) : null, business_slug: b.business_slug ? String(b.business_slug).slice(0, 60) : "demo",
    service_texts: !!b.service_texts, promo_texts: !!b.promo_texts, source: "web",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] || null, user_agent: req.headers.get("user-agent")?.slice(0, 300) || null };
  const r = await fetch(`${SB_URL}/rest/v1/rx_sms_optins`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify(row) });
  if (!r.ok) return Response.json({ ok: false, error: "Could not save right now. Try again in a minute." }, { status: 500, headers: CORS });
  return Response.json({ ok: true }, { headers: CORS });
});
