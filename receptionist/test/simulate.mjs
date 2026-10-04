#!/usr/bin/env node
// Fire fake Vapi webhooks at the deployed rx-agent to prove one line works end to end.
//   RX_WEBHOOK_URL=https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-agent VAPI_WEBHOOK_SECRET=... \
//   RX_SLUG=demo RX_AGENT=after-hours node receptionist/test/simulate.mjs
//
// RX_AGENT picks which line answers (default: the business's lowest-priority active agent).
// The script reads the tools that line was given and exercises whichever flow it can:
// booking lines get the full availability → book_job path, message-only lines get take_message.
const URL = process.env.RX_WEBHOOK_URL || "http://localhost:54321/functions/v1/rx-agent";
const SECRET = process.env.VAPI_WEBHOOK_SECRET || "";
const SLUG = process.env.RX_SLUG || "demo";
const AGENT = process.env.RX_AGENT || "";
const callId = `sim-${Date.now()}`;
const variableValues = { business_slug: SLUG, ...(AGENT ? { agent_slug: AGENT } : {}) };
const call = { id: callId, customer: { number: "+16105550199" }, assistantOverrides: { variableValues } };

async function send(message) {
  const r = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json", "x-vapi-secret": SECRET }, body: JSON.stringify({ message }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\n→ ${message.type}  [${r.status}]`);
  console.log(JSON.stringify(j, null, 2).slice(0, 1500));
  return j;
}
const tool = (name, args) => send({ type: "tool-calls", call, toolCallList: [{ id: `tc-${name}`, function: { name, arguments: args } }] });

const a = await send({ type: "assistant-request", call });
if (!a.assistant) process.exit(1);

const names = (a.assistant.model.tools || []).map((t) => t.function?.name).filter(Boolean);
console.log(`\nline:   ${a.assistant.name}`);
console.log(`role:   ${a.assistant.metadata?.agent_role} (agent_slug=${a.assistant.metadata?.agent_slug})`);
console.log(`prompt: ${a.assistant.model.messages[0].content.length} chars`);
console.log(`tools:  ${names.join(", ") || "none"}`);

let outcome = "info_only";
if (names.includes("check_availability") && names.includes("book_job")) {
  const date = process.env.RX_DATE || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const avail = await tool("check_availability", { date });
  const m = /start=([^,]+), end=([^)]+)\)/.exec(avail.results?.[0]?.result || "");
  if (!m) { console.log(`\nno slot parsed for ${date} — maybe closed that day; try RX_DATE=YYYY-MM-DD`); process.exit(0); }
  await tool("book_job", {
    customer_name: "Test Caller", customer_phone: "+16105550199", address: "123 High St, Pottstown PA", zip: "19464",
    issue: "water heater leaking in basement", urgency: "emergency", window_start: m[1], window_end: m[2], notes: "side door, dog is friendly" });
  outcome = "booked";
} else if (names.includes("take_message")) {
  await tool("take_message", { caller_name: "Test Caller", caller_phone: "+16105550199",
    body: "Tech came Tuesday for the water heater, it's dripping again. Wants a callback today.", callback_pref: "after 5pm" });
  outcome = "message";
} else {
  console.log("\nThis line has no booking or message tool — nothing to exercise.");
}

await send({ type: "end-of-call-report", call, durationSeconds: 97, endedReason: "customer-ended-call",
  analysis: { summary: `Test Caller, water heater, ${outcome}.`, structuredData: { outcome, urgency: "emergency" } },
  artifact: { transcript: "AI: Thanks for calling...\nUser: my water heater is leaking...", recordingUrl: "https://example.invalid/rec.wav" } });

console.log(`\nCheck Supabase:`);
console.log(`  select c.outcome, a.slug as line, a.role from rx_calls c left join rx_agents a on a.id = c.agent_id where c.vapi_call_id = '${callId}';`);
console.log(`  select * from rx_agent_stats where business_id = (select id from rx_businesses where slug = '${SLUG}');`);
