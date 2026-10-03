#!/usr/bin/env node
// Provision the receptionist on Vapi in one shot.
//   node receptionist/vapi/provision.mjs
//
// Env (put in receptionist/.env or export):
//   VAPI_API_KEY          from dashboard.vapi.ai → Settings → API keys (private key)
//   VAPI_WEBHOOK_SECRET   any long random string; must match the Supabase secret of the same name
//   RX_WEBHOOK_URL        https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER   (optional) import your Twilio number into Vapi
//   AREA_CODE             (optional) if no Twilio number, buy a free Vapi number in this area code (e.g. 610)
//
// What it does:
//   1. Creates a "transient-assistant" phone number: every inbound call hits RX_WEBHOOK_URL with
//      type=assistant-request, and the edge function returns the right business's prompt + tools.
//      One number per client; the edge function picks the business by the dialed number.
//   2. Prints the number so you can set it as rx_businesses.agent_number.

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

async function vapi(path, method = "GET", body) {
  const r = await fetch(`https://api.vapi.ai${path}`, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}

const server = { url: URL, secret: SECRET };

// Reuse an existing rx number if one is already pointed at our webhook
const existing = (await vapi("/phone-number")).filter((p) => p.server?.url === URL || p.serverUrl === URL);
if (existing.length) {
  console.log("Already provisioned:");
  for (const p of existing) console.log(`  ${p.number}  (${p.provider}, id ${p.id})`);
  console.log("\nSet rx_businesses.agent_number to one of these. Done.");
  process.exit(0);
}

let num;
if (process.env.TWILIO_NUMBER && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  num = await vapi("/phone-number", "POST", {
    provider: "twilio", number: process.env.TWILIO_NUMBER,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID, twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    name: "TB Receptionist", server,
  });
} else {
  num = await vapi("/phone-number", "POST", {
    provider: "vapi", numberDesiredAreaCode: process.env.AREA_CODE || "610",
    name: "TB Receptionist (demo)", server,
  });
}

console.log(`\nProvisioned ${num.number} (id ${num.id}).`);
console.log(`Every call to it hits ${URL} as assistant-request.`);
console.log(`\nNext:  update public.rx_businesses set agent_number='${num.number}' where slug='demo';`);
