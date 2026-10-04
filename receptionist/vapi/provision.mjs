#!/usr/bin/env node
// Provision one or many receptionist lines on Vapi in one shot.
//
//   node receptionist/vapi/provision.mjs                                  → demo business, 'main' line
//   node receptionist/vapi/provision.mjs demo main after-hours support     → four numbers, one per agent
//   node receptionist/vapi/provision.mjs dne-contracting main booking
//
// Env (put in receptionist/.env or export):
//   VAPI_API_KEY          from dashboard.vapi.ai → Settings → API keys (private key)
//   VAPI_WEBHOOK_SECRET   any long random string; must match the Supabase secret of the same name
//   RX_WEBHOOK_URL        https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN                 (optional) to import Twilio numbers
//   TWILIO_NUMBERS        (optional) comma-separated pool, handed out in the order the agents are listed
//   TWILIO_NUMBER         (optional) a single number — same thing, for one line
//   AREA_CODE             (optional) buy free Vapi numbers in this area code for any line left over (e.g. 610)
//
// What it does, per agent:
//   1. Creates a "transient-assistant" phone number named rx:<business>:<agent>. Every inbound call hits
//      RX_WEBHOOK_URL as assistant-request, and the edge function returns THAT agent's prompt + tools,
//      resolved from the dialed number via rx_agents.phone_number.
//   2. Re-runs are safe: a number already named rx:<business>:<agent> is reused, never duplicated.
//   3. Prints the SQL to point each rx_agents row at its number.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(1); } return v; };
const KEY = need("VAPI_API_KEY");
const SECRET = need("VAPI_WEBHOOK_SECRET");
const URL = need("RX_WEBHOOK_URL");

const [bizSlug = "demo", ...agentArgs] = process.argv.slice(2);
const agentSlugs = agentArgs.length ? agentArgs : ["main"];
const dupe = agentSlugs.find((s, i) => agentSlugs.indexOf(s) !== i);
if (dupe) { console.error(`Agent '${dupe}' listed twice.`); process.exit(1); }

async function vapi(path, method = "GET", body) {
  const r = await fetch(`https://api.vapi.ai${path}`, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}

const server = { url: URL, secret: SECRET };
const nameFor = (agent) => `rx:${bizSlug}:${agent}`;

const all = await vapi("/phone-number");
const byName = new Map(all.map((p) => [p.name, p]));
const taken = new Set(all.map((p) => p.number));

// Twilio numbers to hand out, skipping any already imported into Vapi
const pool = (process.env.TWILIO_NUMBERS || process.env.TWILIO_NUMBER || "")
  .split(",").map((s) => s.trim()).filter(Boolean).filter((n) => !taken.has(n));
const twilioAuth = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
if (pool.length && !twilioAuth) { console.error("TWILIO_NUMBERS set but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are missing."); process.exit(1); }

console.log(`Business '${bizSlug}' — provisioning ${agentSlugs.length} line(s): ${agentSlugs.join(", ")}`);
console.log(`Webhook: ${URL}\n`);

const results = [];
for (const agent of agentSlugs) {
  const name = nameFor(agent);
  const existing = byName.get(name);
  if (existing) {
    // Make sure it still points at this webhook, then leave it alone.
    if (existing.server?.url !== URL) await vapi(`/phone-number/${existing.id}`, "PATCH", { server });
    console.log(`  ${agent.padEnd(14)} ${existing.number}  (existing, ${existing.provider})`);
    results.push({ agent, number: existing.number, id: existing.id, reused: true });
    continue;
  }

  let num;
  const twilioNumber = pool.shift();
  if (twilioNumber) {
    num = await vapi("/phone-number", "POST", {
      provider: "twilio", number: twilioNumber,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID, twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      name, server,
    });
  } else {
    num = await vapi("/phone-number", "POST", {
      provider: "vapi", numberDesiredAreaCode: process.env.AREA_CODE || "610",
      name, server,
    });
  }
  console.log(`  ${agent.padEnd(14)} ${num.number}  (new, ${num.provider})`);
  results.push({ agent, number: num.number, id: num.id, reused: false });
}

console.log(`\nRun this in Supabase → SQL editor:\n`);
for (const { agent, number, id } of results) {
  console.log(`update public.rx_agents set phone_number = '${number}', vapi_phone_number_id = '${id}'`);
  console.log(`  where slug = '${agent}' and business_id = (select id from public.rx_businesses where slug = '${bizSlug}');`);
}
console.log(`\nThen call each number. The edge function picks the agent by the number dialed.`);
