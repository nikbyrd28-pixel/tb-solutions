import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// rx-review-io — the Review Engine's three public doors. Deploy with --no-verify-jwt (anon callers).
//
//   GET  /r/<token>        the link in the text. Counts the tap, 302s to the shop's Google review page.
//                          tbsol.net/r/<token> rewrites here (vercel.json) so the customer sees the shop's agency-free domain.
//   POST /sms              Twilio inbound webhook for TWILIO_FROM. STOP / START / HELP are written to rx_sms_optins
//                          (the same ledger rx-agent and rx-review read) and answered; anything else is forwarded to
//                          the shop owner's cell. Verified with X-Twilio-Signature (TWILIO_AUTH_TOKEN) or ?s=<RX_SYNC_SECRET>.
//   POST /hook/<token>     Housecall Pro / Jobber / Zapier "job completed" webhook. Token = rx_businesses.review_hook_token
//                          (shown in HQ > Reviews). Body is whatever the app sends; we dig out a name + phone.
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

// Twilio signs: base64(HMAC-SHA1(authToken, url + each POST param name+value, sorted by name))
async function twilioSigned(req: Request, url: string, params: URLSearchParams): Promise<boolean> {
  const token = cfg("TWILIO_AUTH_TOKEN");
  if (!token) return false;
  const sig = req.headers.get("x-twilio-signature") || "";
  const keys = [...params.keys()].sort();
  const data = url + keys.map((k) => k + params.get(k)).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  const expect = btoa(String.fromCharCode(...mac));
  if (expect.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

const twiml = (msg?: string | null) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</Message>` : ""}</Response>`, { headers: { "Content-Type": "text/xml" } });

// Field-service apps all shape "job done" differently. Look in the usual places; fall back to a flat scan.
function pickCustomer(b: unknown): { name: string; phone: string; ref: string | null } {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const job = (o.job ?? o.data ?? o.payload ?? o) as Record<string, unknown>;
  const cust = (job.customer ?? job.client ?? o.customer ?? o.client ?? {}) as Record<string, unknown>;
  const name = [cust.first_name, cust.last_name].filter(Boolean).join(" ") || String(cust.name ?? job.customer_name ?? o.name ?? "");
  const phone = String(cust.mobile_number ?? cust.phone ?? cust.mobile ?? cust.home_number ?? job.customer_phone ?? o.phone ?? (Array.isArray(cust.phones) ? (cust.phones[0] as Record<string, unknown>)?.number : "") ?? "");
  const ref = job.id ?? job.invoice_number ?? o.id ?? null;
  return { name: name.trim().slice(0, 120), phone: phone.trim(), ref: ref == null ? null : String(ref).slice(0, 120) };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);     // ["rx-review-io", "r", "<token>"]
  const i = parts.indexOf("rx-review-io");
  const route = parts[i + 1] || "", arg = parts[i + 2] || "";

  if (req.method === "GET" && route === "r" && arg) {
    const link = await rpc<string | null>("rx_review_click", { p_token: arg }).catch(() => null);
    if (!link) return new Response("That link has expired. Search the shop on Google to leave a review.", { status: 404, headers: { "Content-Type": "text/plain" } });
    return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "no-store" } });
  }

  if (req.method === "POST" && route === "sms") {
    await loadCfg();
    const params = new URLSearchParams(await req.text());
    const publicUrl = cfg("REVIEW_SMS_WEBHOOK_URL") || `${SB_URL}/functions/v1/rx-review-io/sms`;
    const ok = (await twilioSigned(req, publicUrl, params)) || (!!cfg("RX_SYNC_SECRET") && url.searchParams.get("s") === cfg("RX_SYNC_SECRET"));
    if (!ok) return new Response("nope", { status: 401 });
    const from = params.get("From") || "", body = params.get("Body") || "";
    const r = await rpc<{ ok: boolean; action: string; reply: string | null; business: string | null; customer: string | null; owner_phone: string | null }>("rx_review_inbound", { p_from: from, p_body: body, p_source: "twilio" }).catch((e) => { console.error(e); return null; });
    if (!r?.ok) return twiml();
    if (r.action === "reply" && r.owner_phone) {
      const who = r.customer ? `${r.customer} (${from})` : from;
      await sms(r.owner_phone, `${r.business || "Your shop"}: ${who} replied to the review text: "${body.slice(0, 300)}". Text them back at ${from}.`).catch(() => {});
    }
    return twiml(r.reply);
  }

  if (req.method === "POST" && route === "hook" && arg) {
    let body: unknown = {};
    const ct = req.headers.get("content-type") || "";
    try { body = ct.includes("json") ? await req.json() : Object.fromEntries(new URLSearchParams(await req.text())); } catch { /* empty */ }
    const c = pickCustomer(body);
    if (!c.phone) return Response.json({ ok: false, error: "no phone in payload" }, { status: 400 });
    const r = await rpc<Record<string, unknown>>("rx_review_hook", { p_token: arg, p_name: c.name, p_phone: c.phone, p_ref: c.ref }).catch((e) => ({ ok: false, error: String(e).slice(0, 200) }));
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }

  return new Response("not found", { status: 404 });
});
