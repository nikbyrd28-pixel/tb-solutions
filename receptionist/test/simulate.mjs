#!/usr/bin/env node
// Fire fake Vapi webhooks at the deployed rx-agent to prove the pipeline end to end.
//   RX_WEBHOOK_URL=https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent VAPI_WEBHOOK_SECRET=... node receptionist/test/simulate.mjs
const URL = process.env.RX_WEBHOOK_URL || "http://localhost:54321/functions/v1/rx-agent";
const SECRET = process.env.VAPI_WEBHOOK_SECRET || "";
const SLUG = process.env.RX_SLUG || "demo";
const callId = `sim-${Date.now()}`;
const call = { id: callId, customer: { number: "+16105550199" }, assistantOverrides: { variableValues: { business_slug: SLUG } } };

async function send(message) {
  const r = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json", "x-vapi-secret": SECRET }, body: JSON.stringify({ message }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\n→ ${message.type}  [${r.status}]`);
  console.log(JSON.stringify(j, null, 2).slice(0, 1500));
  return j;
}

const a = await send({ type: "assistant-request", call });
if (!a.assistant) process.exit(1);
console.log(`\n(prompt is ${a.assistant.model.messages[0].content.length} chars, ${a.assistant.model.tools.length} tools)`);

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const avail = await send({ type: "tool-calls", call, toolCallList: [{ id: "tc1", function: { name: "check_availability", arguments: { date: tomorrow } } }] });
const m = /start=([^,]+), end=([^)]+)\)/.exec(avail.results?.[0]?.result || "");
if (!m) { console.log("no slot parsed — maybe closed tomorrow; try RX_DATE"); process.exit(0); }

await send({ type: "tool-calls", call, toolCallList: [{ id: "tc2", function: { name: "book_job", arguments: {
  customer_name: "Test Caller", customer_phone: "+16105550199", address: "123 High St, Pottstown PA", zip: "19464",
  issue: "water heater leaking in basement", urgency: "emergency", window_start: m[1], window_end: m[2], notes: "side door, dog is friendly" } } }] });

await send({ type: "end-of-call-report", call, durationSeconds: 97, endedReason: "customer-ended-call",
  analysis: { summary: "Test Caller, water heater leak, booked for tomorrow morning.", structuredData: { outcome: "booked", urgency: "emergency" } },
  artifact: { transcript: "AI: Thanks for calling...\nUser: my water heater is leaking...", recordingUrl: "https://example.invalid/rec.wav" } });

console.log(`\nCheck Supabase: select * from rx_jobs where vapi_call_id='${callId}';`);
