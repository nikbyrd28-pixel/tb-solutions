import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Planner intake — every finished Remodel Planner flow (tbsol.net/planner/app/?c=<slug> or a shop's own
// domain) posts here. Saves through the planner_lead_submit() RPC (which checks the slug is live and
// recomputes the estimate from the shop's own ranges), stores any photos / plans in the private
// planner-uploads bucket, texts + emails the shop owner, and texts Nick once: the first lead a new shop gets.
//
// Same pattern as site-intake. Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (or TWILIO_API_KEY/SECRET),
// TWILIO_FROM, NICK_PHONE. Email: RESEND_API_KEY + PLANNER_FROM_EMAIL (e.g. "Remodel Planner <planner@tbsol.net>").
// Without Resend keys the email is logged and skipped; the lead is still saved and texted.
//
// Accepts JSON (no files) or multipart/form-data with a `payload` JSON field plus `files` parts.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const cfg = (k: string) => Deno.env.get(k) || "";
const HDR = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const MAX_FILES = 6, MAX_FILE = 8 * 1024 * 1024;
const OK_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

const money = (n: number | null | undefined) => n == null ? "" : "$" + Math.round(n).toLocaleString("en-US");
const estText = (lo?: number | null, hi?: number | null) => lo != null && hi != null ? `${money(lo)}-${money(hi)}` : "";
const fmtPhone = (p: string | null) => { const d = String(p || "").replace(/\D/g, "").replace(/^1/, ""); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || ""; };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

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

async function email(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = cfg("RESEND_API_KEY"), from = cfg("PLANNER_FROM_EMAIL") || "Remodel Planner <planner@tbsol.net>";
  if (!key || !to) { console.log("[email disabled]", to, subject); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }) });
  if (!r.ok) { console.error("resend", r.status, await r.text()); return false; }
  return true;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: HDR, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`);
  return await r.json();
}

// Which shop is this, and where do its notifications go? Service role, so the notify_* columns are readable.
async function client(slug: string) {
  const r = await fetch(`${SB_URL}/rest/v1/planner_clients?slug=eq.${encodeURIComponent(slug)}&active=is.true&select=id,slug,business_name,owner_name,notify_phone,notify_email,phone,intake&limit=1`, { headers: HDR });
  if (!r.ok) throw new Error(`client ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

async function upload(slug: string, leadId: string, f: File, i: number) {
  const safe = (f.name || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const path = `${slug}/${leadId}/${i + 1}-${safe}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/planner-uploads/${path}`, {
    method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": f.type || "application/octet-stream", "x-upsert": "true" }, body: f });
  if (!r.ok) { console.error("upload", r.status, await r.text()); return null; }
  return { path, name: f.name, size: f.size, type: f.type };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });

  // deno-lint-ignore no-explicit-any
  let b: any; const files: File[] = [];
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      b = JSON.parse(String(fd.get("payload") || "{}"));
      for (const f of fd.getAll("files")) if (f instanceof File && f.size > 0) files.push(f);
    } else b = await req.json();
  } catch { return new Response("bad body", { status: 400, headers: CORS }); }
  if (b._honey) return Response.json({ ok: true }, { headers: CORS });

  const slug = String(b.slug || b.client || "").toLowerCase().trim();
  if (!slug) return Response.json({ ok: false, error: "Missing client." }, { status: 400, headers: CORS });
  const c = await client(slug);
  if (!c) return Response.json({ ok: false, error: "This planner is not live." }, { status: 404, headers: CORS });

  if (files.length > MAX_FILES) return Response.json({ ok: false, error: `Up to ${MAX_FILES} files, please.` }, { status: 400, headers: CORS });
  for (const f of files) {
    if (f.size > MAX_FILE) return Response.json({ ok: false, error: `${f.name} is over 8 MB.` }, { status: 400, headers: CORS });
    if (!OK_TYPES.test(f.type)) return Response.json({ ok: false, error: `${f.name}: photos and PDFs only.` }, { status: 400, headers: CORS });
  }

  const payload = {
    slug, name: b.name, phone: b.phone, email: b.email, town: b.town, zip: b.zip,
    project_type: b.project_type, scope: b.scope, timeline: b.timeline, budget: b.budget, notes: b.notes,
    contact_pref: b.contact_pref, sms_consent: b.sms_consent === true || b.sms_consent === "1" || b.sms_consent === "true",
    answers: typeof b.answers === "object" && b.answers ? b.answers : {},
    source_url: b.source_url || b.page || null, utm: typeof b.utm === "object" ? b.utm : null,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] || null, user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
  };
  let res; try { res = await rpc("planner_lead_submit", { p: payload }); } catch (e) { console.error(e); return Response.json({ ok: false, error: "Couldn't save that. Call the shop instead." }, { status: 500, headers: CORS }); }
  if (!res?.ok) return Response.json({ ok: false, error: res?.error || "Couldn't save that." }, { status: 400, headers: CORS });
  if (!res.id) return Response.json({ ok: true }, { headers: CORS }); // honeypot path inside the RPC

  const saved: { path: string; name: string; size: number; type: string }[] = [];
  for (let i = 0; i < files.length; i++) { const u = await upload(slug, res.id, files[i], i); if (u) saved.push(u); }
  if (saved.length) { try { await rpc("planner_lead_attach", { p_id: res.id, p_files: saved }); } catch (e) { console.error(e); } }

  // ---- notify the owner ----
  const name = String(b.name || "").trim(), first = name.split(" ")[0];
  const est = estText(res.est_low, res.est_high);
  const projLine = [b.project_label || b.project_type, b.scope_label || b.scope].filter(Boolean).join(" · ");
  const when = ({ asap: "ready soon", "3months": "next few months", thisyear: "this year", unsure: "just thinking" } as Record<string, string>)[b.timeline] || b.timeline || "";
  const budget = b.budget_label || b.budget || "";
  const contact = payload.phone ? fmtPhone(String(payload.phone)) : String(payload.email || "");
  const hqLink = "https://tbsol.net/hq/";
  const smsBody = `NEW REMODEL JOB · ${c.business_name}\n${name}${b.town ? " · " + b.town : ""}\n${projLine}${est ? " · " + est : ""}\n${[when, budget].filter(Boolean).join(" · ")}${saved.length ? `\n${saved.length} file${saved.length === 1 ? "" : "s"} attached` : ""}\n${contact}${b.contact_pref ? " (prefers " + b.contact_pref + ")" : ""}${b.notes ? "\n" + String(b.notes).slice(0, 160) : ""}`;
  const tasks: Promise<unknown>[] = [];
  if (c.notify_phone) tasks.push(sms(c.notify_phone, smsBody));
  if (c.notify_email) {
    const rows: [string, string][] = [["Name", name], ["Phone", payload.phone ? fmtPhone(String(payload.phone)) : ""], ["Email", String(payload.email || "")], ["Town", String(b.town || "")],
      ["Project", projLine], ["Typical range", est], ["Timeline", when], ["Budget", budget], ["Prefers", String(b.contact_pref || "")], ["Notes", String(b.notes || "")],
      ["Files", saved.map((s) => s.name).join(", ")], ["From", String(payload.source_url || "")]].filter(([, v]) => v) as [string, string][];
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111"><h2 style="margin:0 0 12px">New remodel job request</h2><table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>${saved.length ? `<p>Files are in your HQ lead record (${esc(hqLink)}).</p>` : ""}<p style="color:#666;font-size:13px;margin-top:18px">Sent by your Remodel Planner, built by TB Solutions.</p></div>`;
    tasks.push(email(c.notify_email, `New remodel job: ${name}${projLine ? " · " + projLine : ""}${est ? " · " + est : ""}`, html, rows.map(([k, v]) => `${k}: ${v}`).join("\n")));
  }
  // Optional auto-reply to the homeowner, only when the shop turned it on and the homeowner ticked consent.
  if (c.intake?.autoreply && payload.sms_consent && payload.phone) {
    tasks.push(sms(String(payload.phone), `${c.business_name}: Hi ${first}, got your ${b.project_label || "project"} request. ${c.owner_name || "We"} will reach out within one business day. Reply STOP to opt out.`));
  }
  // Nick, once per shop: the first lead their planner ever produced.
  const nick = cfg("NICK_PHONE");
  if (nick && res.first_lead) tasks.push(sms(nick, `PLANNER: first lead for ${c.business_name} (${slug}) just landed. ${name} · ${projLine}${est ? " · " + est : ""}. Check in with the owner today.`));
  await Promise.allSettled(tasks);

  return Response.json({ ok: true, id: res.id, est_low: res.est_low, est_high: res.est_high, files: saved.length }, { headers: CORS });
});
