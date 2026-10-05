import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Stripe Checkout for client invoices.
//
//   POST /rx-pay            (client's Supabase JWT)  → { url } to send them to Checkout
//   POST /rx-pay?hook=1     (Stripe's signed webhook) → marks the invoice paid
//
// Deploy with verify_jwt false — the webhook has no Supabase JWT, and the checkout route
// does its own auth by handing the caller's JWT to PostgREST.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY       sk_live_… or sk_test_…
//   STRIPE_WEBHOOK_SECRET   whsec_… from the Stripe webhook endpoint you create
//   PAY_RETURN_URL          optional, where Stripe sends them back (default the client app)

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SK = Deno.env.get("STRIPE_SECRET_KEY") || "";
const WHSEC = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const RETURN_URL = Deno.env.get("PAY_RETURN_URL") || "https://tbsol.net/receptionist/app/";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

// Constant-time compare so a wrong signature cannot be guessed byte by byte.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

// Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256. Verify before trusting a single byte.
export async function verifyStripe(raw: string, header: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<{ ok: boolean; reason?: string }> {
  if (!header) return { ok: false, reason: "no signature header" };
  const parts = Object.create(null) as Record<string, string[]>;
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i < 0) continue;
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
    (parts[k] ||= []).push(v);
  }
  const t = parts.t?.[0];
  const sigs = parts.v1 || [];
  if (!t || !sigs.length) return { ok: false, reason: "malformed signature header" };
  // Replay guard: Stripe recommends rejecting anything older than five minutes.
  if (Math.abs(nowSec - Number(t)) > 300) return { ok: false, reason: "timestamp outside tolerance" };

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some(s => safeEqual(s, mac)) ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

async function stripe(path: string, body: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `stripe ${r.status}`);
  return j;
}

// PostgREST as the signed-in client, so their own RLS and ownership checks apply.
async function asUser(jwt: string, fn: string, args: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(JSON.parse(text || "{}")?.message || `rpc ${r.status}`);
  return text ? JSON.parse(text) : null;
}

async function asService(fn: string, args: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) { console.error("rpc", fn, r.status, text); throw new Error(`rpc ${r.status}`); }
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ ok: true, service: "rx-pay" });
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const url = new URL(req.url);

  // ---------- Stripe webhook ----------
  if (url.searchParams.has("hook")) {
    const raw = await req.text();
    if (!WHSEC) { console.error("STRIPE_WEBHOOK_SECRET not set"); return new Response("not configured", { status: 500 }); }
    const v = await verifyStripe(raw, req.headers.get("stripe-signature") || "", WHSEC);
    // A webhook that fails verification is not from Stripe. Never act on it.
    if (!v.ok) { console.error("webhook rejected:", v.reason); return new Response("bad signature", { status: 400 }); }

    let evt: any;
    try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

    if (evt.type === "checkout.session.completed" || evt.type === "checkout.session.async_payment_succeeded") {
      const s = evt.data?.object || {};
      if (s.payment_status === "paid") {
        const res = await asService("hq_invoice_mark_paid", { p_session: s.id, p_intent: s.payment_intent || null });
        console.log("mark_paid", s.id, JSON.stringify(res));
      }
    }
    // Always 200 once verified, or Stripe retries forever on events we simply ignore.
    return json({ received: true });
  }

  // ---------- create a Checkout session ----------
  if (!SK) return json({ error: "Payments are not switched on yet." }, 503);
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) return json({ error: "not signed in" }, 401);

  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!body?.invoice_id) return json({ error: "invoice_id required" }, 400);

  try {
    // Ownership, status and amount are all decided by the database, not by the caller.
    const inv = await asUser(jwt, "rx_owner_invoice_for_pay", { p_invoice: body.invoice_id });
    if (!inv) return json({ error: "not your invoice" }, 403);

    const period = inv.period_start ? ` — ${inv.period_start}${inv.period_end ? " to " + inv.period_end : ""}` : "";
    const session = await stripe("checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(inv.amount_cents),
      "line_items[0][price_data][product_data][name]": `TB Solutions${period}`,
      "line_items[0][quantity]": "1",
      success_url: `${RETURN_URL}?paid=1`,
      cancel_url: `${RETURN_URL}?paid=0`,
      client_reference_id: inv.id,
      "metadata[invoice_id]": inv.id,
      "metadata[business]": inv.name || "",
    });

    // Record the session before returning it, so the webhook can find the invoice.
    await asService("hq_invoice_set_session", { p_invoice: inv.id, p_session: session.id });
    console.log("checkout", inv.id, money(inv.amount_cents), session.id);
    return json({ url: session.url, amount_cents: inv.amount_cents });
  } catch (e) {
    console.error("rx-pay", e);
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
