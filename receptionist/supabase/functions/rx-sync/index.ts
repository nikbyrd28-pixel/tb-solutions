import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// rx-sync — pushes a booked rx_jobs row into the client's field-service app (Housecall Pro today; Jobber next).
// Called by a pg_net trigger on rx_jobs insert (see 004_rx_integrations.sql). Authed by x-rx-sync-secret.
// Writes external_ref back on the job so HQ shows "in HCP". Never throws into the booking flow.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const db = async <T>(path: string, init: RequestInit = {}) => { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers || {}) } }); if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`); const t = await r.text(); return (t ? JSON.parse(t) : null) as T; };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const SECRET = Deno.env.get("RX_SYNC_SECRET") || await db<any[]>("rx_config?key=eq.RX_SYNC_SECRET&select=value").then(r => r?.[0]?.value || "").catch(() => "");
  if (SECRET && req.headers.get("x-rx-sync-secret") !== SECRET) return new Response("nope", { status: 401 });
  let body: any; try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const job = body.record || body.job || body; // pg_net trigger sends {record}
  if (!job?.id || !job?.business_id) return Response.json({ ok: false, error: "no job" });
  try {
    const ints = await db<any[]>(`rx_integrations?business_id=eq.${job.business_id}&active=eq.true&select=*`);
    const results: Record<string, string> = {};
    for (const i of ints) {
      if (i.provider === "housecallpro") results.housecallpro = await pushHousecallPro(i, job);
      else results[i.provider] = "unsupported";
    }
    const ref = results.housecallpro && !results.housecallpro.startsWith("error") ? `hcp:${results.housecallpro}` : null;
    if (ref) await db(`rx_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ external_ref: ref }) });
    await db("rx_sync_log", { method: "POST", body: JSON.stringify({ job_id: job.id, business_id: job.business_id, results }) }).catch(() => {});
    return Response.json({ ok: true, results });
  } catch (e) {
    console.error("rx-sync", e);
    await db("rx_sync_log", { method: "POST", body: JSON.stringify({ job_id: job.id, business_id: job.business_id, results: { error: String(e).slice(0, 500) } }) }).catch(() => {});
    return Response.json({ ok: false, error: String(e) });
  }
});

// ---- Housecall Pro (public API; needs their API key from HCP Settings → API, MAX plan) ----
async function pushHousecallPro(i: any, job: any): Promise<string> {
  const base = (i.settings?.base_url || "https://api.housecallpro.com").replace(/\/$/, "");
  const hh = { Authorization: `Token ${i.api_key}`, "Content-Type": "application/json", Accept: "application/json" };
  const call = async (path: string, init: RequestInit = {}) => { const r = await fetch(base + path, { ...init, headers: hh }); const t = await r.text(); if (!r.ok) throw new Error(`hcp ${path} ${r.status} ${t.slice(0, 300)}`); return t ? JSON.parse(t) : {}; };
  try {
    const [first, ...rest] = String(job.customer_name || "Caller").trim().split(/\s+/);
    const mobile = String(job.customer_phone || "").replace(/^\+1/, "");
    // 1. find or create the customer by phone
    let customer: any = null;
    if (mobile) { const q = await call(`/customers?q=${encodeURIComponent(mobile)}&page_size=5`); customer = (q.customers || q.data || []).find((c: any) => String(c.mobile_number || c.home_number || "").replace(/\D/g, "").endsWith(mobile.replace(/\D/g, ""))) || null; }
    const addr = parseAddress(job.address, job.zip);
    if (!customer) customer = await call("/customers", { method: "POST", body: JSON.stringify({ first_name: first, last_name: rest.join(" ") || "(from phone)", mobile_number: mobile || undefined, notifications_enabled: true, lead_source: "AI receptionist", addresses: addr ? [addr] : [] }) });
    let addressId = customer.addresses?.[0]?.id;
    if (!addressId && addr) { const a = await call(`/customers/${customer.id}/addresses`, { method: "POST", body: JSON.stringify(addr) }); addressId = a.id; }
    // 2. create the job in the arrival window the receptionist booked
    const j = await call("/jobs", { method: "POST", body: JSON.stringify({
      customer_id: customer.id, address_id: addressId,
      schedule: { scheduled_start: job.window_start, scheduled_end: job.window_end, arrival_window: Math.max(0, Math.round((new Date(job.window_end).getTime() - new Date(job.window_start).getTime()) / 60000)) },
      line_items: [{ name: job.issue || "Service call", description: job.notes || "", unit_price: Math.round(job.quoted_fee_cents || 0), quantity: 1, kind: "labor", unit_cost: 0 }],
      notes: `Booked by AI receptionist. Urgency: ${job.urgency || "standard"}. ${job.notes || ""}`.trim(),
      lead_source: "AI receptionist", tags: ["receptionist", job.urgency || "standard"],
      assigned_employee_ids: i.settings?.assign_to ? [i.settings.assign_to] : undefined,
    }) });
    return String(j.id || j.invoice_number || "created");
  } catch (e) { return "error: " + String(e).slice(0, 300); }
}
function parseAddress(s: string | null, zip: string | null) {
  if (!s) return null;
  const m = String(s).match(/^(.*?)(?:,\s*([^,]+?))?(?:,?\s*([A-Z]{2}))?\s*(\d{5})?\s*$/);
  return { street: (m?.[1] || s).trim(), city: m?.[2]?.trim() || "", state: m?.[3] || "PA", zip: zip || m?.[4] || "", country: "US", type: "service" };
}
