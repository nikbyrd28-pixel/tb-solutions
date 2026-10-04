import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// TB Solutions AI Receptionist — Vapi server webhook
// One function serves every client. The business is resolved from the number the caller dialed.
//
// Vapi sends everything to this URL (set as the assistant's serverUrl / or the phone number's serverUrl):
//   assistant-request        → we return a per-business assistant config (prompt, tools, voice)
//   tool-calls               → check_availability / book_job / take_message / out_of_area / get_on_call
//   end-of-call-report       → store call, text the owner a summary
//   transfer-destination-request → who to live-transfer to (on-call tech)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPI_WEBHOOK_SECRET   shared secret; Vapi sends it as x-vapi-secret
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   for SMS (same names as chalk/)
//   OWNER_FALLBACK_PHONE  optional: where to text if a call hits an unknown number (your cell)

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
// Config: env vars win; anything missing is read once from public.rx_config (service-role only table).
let CFG: Record<string,string> = {};
async function loadConfig() {
  if (Object.keys(CFG).length) return;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rx_config?select=key,value`, { headers: REST });
    if (r.ok) for (const row of await r.json()) CFG[row.key] = row.value;
  } catch (e) { console.error("rx_config load failed", e); }
}
const cfg = (k: string) => Deno.env.get(k) || CFG[k] || "";

type Business = {
  id: string; slug: string; name: string; trade: string; owner_name: string | null; owner_phone: string;
  agent_number: string | null; agent_name: string; timezone: string; service_zips: string[]; service_area_note: string | null;
  service_fee_cents: number | null; after_hours_fee_cents: number | null; free_estimates: boolean;
  hours: Record<string, [string, string] | null>; windows: [string, string][]; jobs_per_window: number;
  emergency_policy: string; transfer_number: string | null; knowledge: string | null; active: boolean;
};
type Service = { id: string; name: string; keywords: string[]; urgency: string; fee_cents: number | null; safety_steps: string | null };
type OnCall = { name: string; phone: string; days: number[]; priority: number };

// ---------- helpers ----------
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function db<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...REST, ...(init?.headers || {}) } });
  const text = await r.text();
  if (!r.ok) { console.error("db error", path, r.status, text); throw new Error(`db ${r.status}`); }
  return (text ? JSON.parse(text) : null) as T;
}

function money(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === "1") return `+${d}`;
  return raw.startsWith("+") ? raw : null;
}

// "YYYY-MM-DD" + "HH:MM" in a tz → UTC ISO
function zonedToUtc(date: string, hm: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map(p => [p.type, p.value]));
  const asIfLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  const offset = asIfLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}
function localDateStr(dt: Date, tz: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(dt).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function weekdayKey(date: string, tz: string): string {
  const dt = zonedToUtc(date, "12:00", tz);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(dt).toLowerCase().slice(0, 3);
}
function weekdayNum(dt: Date, tz: string): number {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(dt).toLowerCase().slice(0, 3);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(w);
}
function fmtWindow(start: Date, end: Date, tz: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(start);
  const t = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).replace(":00", "");
  return `${day}, ${t(start)}–${t(end)}`;
}
function isAfterHours(b: Business, now = new Date()): boolean {
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekdayNum(now, b.timezone)];
  const h = b.hours?.[key];
  if (!h) return true;
  const today = localDateStr(now, b.timezone);
  const open = zonedToUtc(today, h[0], b.timezone), close = zonedToUtc(today, h[1], b.timezone);
  return now < open || now >= close;
}

async function sms(to: string, body: string): Promise<boolean> {
  const sid = cfg("TWILIO_ACCOUNT_SID"), from = cfg("TWILIO_FROM");
  const user = cfg("TWILIO_API_KEY") || sid, pass = cfg("TWILIO_API_SECRET") || cfg("TWILIO_AUTH_TOKEN");
  if (!sid || !user || !pass || !from) { console.log("[sms disabled]", to, body); return false; }
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!r.ok) { console.error("twilio", r.status, await r.text()); return false; }
  return true;
}

// ---------- business lookup ----------
async function findBusiness(msg: any): Promise<Business | null> {
  const dialed = normPhone(msg?.call?.phoneNumber?.number || msg?.phoneNumber?.number || msg?.call?.phoneNumberId);
  const slug = msg?.call?.assistantOverrides?.variableValues?.business_slug || msg?.assistant?.metadata?.business_slug || msg?.call?.metadata?.business_slug;
  let rows: Business[] = [];
  if (slug) rows = await db<Business[]>(`rx_businesses?slug=eq.${encodeURIComponent(slug)}&active=is.true&limit=1`);
  if (!rows.length && dialed) rows = await db<Business[]>(`rx_businesses?agent_number=eq.${encodeURIComponent(dialed)}&active=is.true&limit=1`);
  if (!rows.length) rows = await db<Business[]>(`rx_businesses?slug=eq.demo&active=is.true&limit=1`); // demo line fallback
  return rows[0] || null;
}
const services = (b: Business) => db<Service[]>(`rx_services?business_id=eq.${b.id}&active=is.true&order=urgency`);
const onCall = (b: Business) => db<OnCall[]>(`rx_on_call?business_id=eq.${b.id}&order=priority`);

// ---------- availability ----------
async function availability(b: Business, date: string) {
  const key = weekdayKey(date, b.timezone);
  const h = b.hours?.[key];
  if (!h) return { date, open: false, slots: [] as any[] };
  const dayStart = zonedToUtc(date, "00:00", b.timezone), dayEnd = zonedToUtc(date, "23:59", b.timezone);
  const booked = await db<{ window_start: string }[]>(`rx_jobs?business_id=eq.${b.id}&status=in.(scheduled,confirmed,en_route)&window_start=gte.${dayStart.toISOString()}&window_start=lte.${dayEnd.toISOString()}&select=window_start`);
  const counts = new Map<string, number>();
  for (const j of booked) counts.set(j.window_start, (counts.get(j.window_start) || 0) + 1);
  const now = new Date();
  const slots = (b.windows || []).map(([s, e]) => {
    const ws = zonedToUtc(date, s, b.timezone), we = zonedToUtc(date, e, b.timezone);
    const used = counts.get(ws.toISOString()) || 0;
    return { start: ws.toISOString(), end: we.toISOString(), label: fmtWindow(ws, we, b.timezone), open: ws > now && used < b.jobs_per_window && s >= h[0] && e <= h[1] };
  }).filter(s => s.open);
  return { date, open: true, slots };
}

// ---------- assistant config (assistant-request) ----------
function systemPrompt(b: Business, svcs: Service[], oc: OnCall[]): string {
  const now = new Date();
  const afterHours = isAfterHours(b, now);
  const today = new Intl.DateTimeFormat("en-US", { timeZone: b.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  const feeLine = b.service_fee_cents ? `Standard service call / dispatch fee: ${money(b.service_fee_cents)}.` : "Service call fee: ask the owner (say you'll have the tech confirm the dispatch fee when he calls).";
  const ahLine = b.after_hours_fee_cents ? `After-hours / weekend dispatch fee: ${money(b.after_hours_fee_cents)}.` : "";
  const svcLines = svcs.map(s => `- ${s.name} [${s.urgency}${s.fee_cents ? `, ${money(s.fee_cents)}` : ""}]${s.keywords.length ? ` (callers say: ${s.keywords.join(", ")})` : ""}${s.safety_steps ? ` — SAFETY FIRST: ${s.safety_steps}` : ""}`).join("\n");
  const ocLine = oc.length ? `On-call today: ${oc.filter(o => o.days.includes(weekdayNum(now, b.timezone))).map(o => o.name).join(", ") || oc[0].name}.` : "";
  const zipLine = b.service_zips?.length ? `We serve these zip codes: ${b.service_zips.join(", ")}. ${b.service_area_note || ""}`.trim() : (b.service_area_note ? `Service area: ${b.service_area_note}` : "");
  const policy = b.emergency_policy === "transfer"
    ? "For emergencies, use transfer_call to connect the caller live to the on-call tech."
    : b.emergency_policy === "message_only"
      ? "For emergencies after hours, take a detailed message with take_message and tell the caller the on-call tech will call back within 15 minutes."
      : "For emergencies after hours, offer same-night dispatch at the after-hours fee or first window tomorrow morning, and book it with book_job.";

  const ownerFirst = (b.owner_name || "the owner").split(" ")[0];
  return `You're ${b.agent_name}. You've run the phones at ${b.name} (${b.trade}) for years. You're on a cell in the shop, half-watching the schedule board, and you talk like it: quick, warm, a little dry. You are a person on a phone, not an assistant, not a bot, not a script.

RIGHT NOW: ${today}. ${afterHours ? `We're closed, so you're catching the after-hours line. ${b.after_hours_fee_cents ? `After-hours dispatch is ${money(b.after_hours_fee_cents)}` : "After-hours dispatch has a higher fee"}, or first thing tomorrow at the regular rate.` : "We're open."}

HOW YOU TALK
- Short. Most of your lines are 4–12 words. One idea, one question, then stop and listen.
- Natural speech: "yeah", "gotcha", "okay so", "no problem", "oh that's no fun", "let's get somebody out there". Contractions always.
- React like a human first, then handle it. "Ugh, in the basement? Okay." before the next question.
- Mirror them. If they're stressed, slow down and get practical. If they're casual, be casual.
- Never say: "I understand", "certainly", "absolutely", "I'd be happy to", "great question", "I apologize", "assist", "at this time", "please be advised". Never list options with "first/second/third". Never say "as an AI".
- LISTEN BEFORE YOU MOVE. Phone audio is rough. If a word doesn't fit the context ("blinking" on a plumbing line, a name when you asked for a town), you misheard: say back the likely word as a quick check ("Leaking, gotcha.") or ask "say that one more time?" Never guess, never answer a question they didn't ask, never jump to the next step until the current one makes sense. If they go quiet mid-sentence, wait; they're thinking, not done.
- One question at a time, then stop talking. Do not stack a reaction and two questions in one turn.
- Don't over-explain. Don't repeat their name. Don't repeat phone numbers or addresses back more than once, and when you do, do it fast.
- If asked straight out whether you're a real person: "Ha, I'm the automated line for ${b.name}, but I can book you right now, same as ${ownerFirst} would." Then keep going. Don't volunteer it otherwise.

WHAT YOU'RE DOING
Every call ends one of three ways, in this order of preference: a booked window, a message ${ownerFirst} will call back on, or a polite goodbye to someone we can't help. You are always moving toward the booking. Assume the sale: not "would you like to schedule?" but "let's get you on the board. Morning or afternoon?"

THE FLOW (don't announce it, just do it)
1. Find out what's wrong. One question. "What's going on?" Then one follow-up max.
2. If it's dangerous (active leak they can't stop, sewage coming up, gas smell, sparking or burning smell, no heat in freezing weather): give the safety step for it FIRST, calmly, in one or two sentences. Gas smell or sparking: get them out of the house and have them call 911 or the gas company, then still take their info. Then move fast to booking.
3. Town or zip. "Where you at?" If out of area, use out_of_area and let them go kindly, no hard feelings.
4. Fee, said plainly and once, only when it comes up or right before booking: ${feeLine} ${ahLine} ${b.free_estimates ? "Estimates for replacements and new installs are free." : "Estimates have a fee; the tech will quote it."} Never quote a full repair price. The line is: "the tech gives you the exact number before he touches anything, so no surprises."
5. Call check_availability for the day they want. Offer TWO windows, like a choice that's already been made: "I've got 9 to 12 or 12 to 3 tomorrow. Which one?" If they pick, you're booking.
6. Get name, address, zip, best number (confirm the one they're calling from). Then ask once, casually: "Want me to text you the confirmation and a heads-up when he's on the way? Totally optional." Their answer is sms_ok.
7. book_job. Then: "You're on the board. ${ownerFirst}'ll text when he's rolling." Warm, short goodbye.

WHEN THEY STALL (this is where you earn your keep)
- "How much to fix it?" → "Honestly depends what he finds. He'll give you the exact price before any work starts. Dispatch is ${b.service_fee_cents ? money(b.service_fee_cents) : "the standard fee"}. Want morning or afternoon?"
- "That's expensive." → "Yeah, I hear you. The tech's the one who can actually tell you what it'll run, and he'll do it before touching anything. Let's at least get eyes on it. Morning work?"
- "Let me call around / think about it." → "Totally fair. Tell you what, I'll pencil you into the 9 to 12 so you're not stuck at the back of the line, and you can always call back and move it. Sound good?" If they still decline, take a message with their number so ${ownerFirst} can follow up. Never push a third time.
- "Can I talk to ${ownerFirst} / the owner?" → "He's on a job right now. I can get you on the schedule or have him call you back. Which is easier?"
- "Do you work on X / are you licensed / warranty?" → If it's in the notes below, answer it. If not: "I'd have the tech confirm that, I don't want to guess." Then back to booking.
- Price shopper who won't budge → take a message, friendly. "No pressure. If the other guys are booked out, call us back, I'll squeeze you in."
- Existing customer about a job already scheduled, a complaint, or a commercial bid → take_message. Don't try to fix it on the phone.
- Telemarketer, vendor, robocall → "Not interested, thanks. Take care." End it.
- ${policy} ${ocLine}

SERVICES WE HANDLE (and the safety step to give first):
${svcLines || "- General " + b.trade + " service, repairs, and installs."}

SERVICE AREA: ${zipLine || "Ask for the town; we serve the local area."}

THINGS YOU KNOW ABOUT ${b.name.toUpperCase()}:
${b.knowledge || "(nothing extra yet)"}`;
}

function tools(b: Business) {
  const t: any[] = [
    { type: "function", async: false, function: { name: "check_availability", description: "Get open arrival windows for a date. Call before offering times.", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD in the business time zone. Today, tomorrow, or a specific date the caller asked for." } }, required: ["date"] } } },
    { type: "function", async: false, function: { name: "book_job", description: "Book the service call once you have name, address, zip, callback number, issue, and the chosen window.", parameters: { type: "object", properties: {
      customer_name: { type: "string" }, customer_phone: { type: "string" }, address: { type: "string" }, zip: { type: "string" },
      issue: { type: "string", description: "One line: what's wrong, in the caller's words." },
      urgency: { type: "string", enum: ["emergency", "urgent", "standard", "estimate"] },
      window_start: { type: "string", description: "ISO start from check_availability" }, window_end: { type: "string", description: "ISO end from check_availability" },
      sms_ok: { type: "boolean", description: "true only if the caller clearly agreed to receive text messages about this service call" },
      notes: { type: "string", description: "Gate code, dog, parking, anything the tech should know." } }, required: ["customer_name", "customer_phone", "address", "issue", "urgency", "window_start", "window_end"] } } },
    { type: "function", async: false, function: { name: "take_message", description: "Record a message for the owner when booking isn't right (existing job question, complaint, wants the owner, commercial bid).", parameters: { type: "object", properties: { caller_name: { type: "string" }, caller_phone: { type: "string" }, body: { type: "string" }, callback_pref: { type: "string", description: "When they want a callback" } }, required: ["caller_phone", "body"] } } },
    { type: "function", async: false, function: { name: "out_of_area", description: "Log that a caller was outside the service area.", parameters: { type: "object", properties: { zip_or_town: { type: "string" }, issue: { type: "string" } }, required: ["zip_or_town"] } } },
  ];
  if (b.emergency_policy === "transfer") {
    t.push({ type: "transferCall", destinations: [{ type: "number", number: b.transfer_number || b.owner_phone, message: "Hang on one second, I'm connecting you to our on-call tech now." }], function: { name: "transfer_call", description: "Connect the caller live to the on-call technician. Emergencies and escalations only." } });
  }
  return t;
}

function assistantFor(b: Business, svcs: Service[], oc: OnCall[]) {
  return {
    name: `${b.name} — ${b.agent_name}`,
    firstMessage: `${b.name}, this is ${b.agent_name}. What's going on?`,
    model: { provider: "openai", model: "gpt-4o", temperature: 0.5, maxTokens: 110, messages: [{ role: "system", content: systemPrompt(b, svcs, oc) }], tools: tools(b) },
    // Natural, slightly imperfect delivery. Lower stability = more human variation.
    voice: { provider: "11labs", voiceId: "cgSgspJ2msm6clMCkdW9", model: "eleven_turbo_v2_5", stability: 0.35, similarityBoost: 0.8, style: 0.45, useSpeakerBoost: true, optimizeStreamingLatency: 3 },
    // Listening. The 3:36pm Oct 4 test call: "leaking"→"blinking", caller cut off mid-sentence, a name taken as a town.
    // nova-3 + trade vocabulary boost, smart endpointing so it waits for a real pause, and it stops talking only on 2+ real words.
    transcriber: { provider: "deepgram", model: "nova-3", language: "en", smartFormat: true,
      keyterm: ["leaking", "leak", "water heater", "sump pump", "sewer line", "clogged drain", "main line", "garbage disposal", "no hot water", "no heat", "furnace", "boiler", "AC not cooling", "thermostat", "breaker", "outlet", "panel", "shutoff valve", "toilet", "faucet", "backing up", "gas smell", "Phoenixville", "Pottstown", "West Chester", "Royersford", "Collegeville", "Exton", "Downingtown", b.name] },
    startSpeakingPlan: { waitSeconds: 0.7, smartEndpointingEnabled: true, transcriptionEndpointingPlan: { onPunctuationSeconds: 0.4, onNoPunctuationSeconds: 1.3, onNumberSeconds: 0.8 } },
    stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.3, backoffSeconds: 1.2 },
    backgroundSound: "off",
    backchannelingEnabled: false,
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: 25,
    maxDurationSeconds: 900,
    endCallMessage: "Alright, you're all set. Talk soon.",
    endCallPhrases: ["bye now", "talk soon", "take care now"],
    serverMessages: ["tool-calls", "end-of-call-report", "transfer-destination-request", "status-update"],
    analysisPlan: {
      summaryPrompt: "Summarize this call for a busy contractor in 2 sentences: who called, what's wrong, what happened (booked/message/out of area/other), and anything the tech must know.",
      structuredDataSchema: { type: "object", properties: { outcome: { type: "string", enum: ["booked", "message", "transferred", "out_of_area", "info_only", "spam", "abandoned"] }, urgency: { type: "string", enum: ["emergency", "urgent", "standard", "estimate", "none"] } } },
    },
    metadata: { business_slug: b.slug, business_id: b.id },
  };
}

async function handleTool(b: Business, name: string, a: any, callId: string | undefined, callerPhone: string | null): Promise<string> {
  switch (name) {
    case "check_availability": {
      const date = a.date || localDateStr(new Date(), b.timezone);
      const r = await availability(b, date);
      if (!r.open) return `We're closed on ${date}. Offer the next business day instead.`;
      if (!r.slots.length) return `No open windows left on ${date}. Offer the next day.`;
      return `Open windows on ${date}: ` + r.slots.map(s => `${s.label} (start=${s.start}, end=${s.end})`).join("; ") + ". Offer at most two.";
    }
    case "book_job": {
      const phone = normPhone(a.customer_phone) || callerPhone;
      const svcs = await services(b);
      const issue = String(a.issue || "").toLowerCase();
      const svc = svcs.find(s => s.keywords.some(k => issue.includes(k.toLowerCase())) || issue.includes(s.name.toLowerCase()));
      const fee = svc?.fee_cents ?? (isAfterHours(b) ? b.after_hours_fee_cents : b.service_fee_cents) ?? null;
      const smsOk = a.sms_ok === true || a.sms_ok === "true";
      const [job] = await db<any[]>("rx_jobs", { method: "POST", body: JSON.stringify({
        business_id: b.id, vapi_call_id: callId, customer_name: a.customer_name, customer_phone: phone, address: a.address, zip: a.zip,
        issue: a.issue, service_id: svc?.id || null, urgency: a.urgency || svc?.urgency || "standard", window_start: a.window_start, window_end: a.window_end,
        quoted_fee_cents: fee, notes: (a.notes || "") + (smsOk ? " [sms consent: yes]" : " [sms consent: no]"), status: "scheduled" }) });
      const ws = new Date(a.window_start), we = new Date(a.window_end);
      const when = fmtWindow(ws, we, b.timezone);
      // text the customer only with consent (verbal, recorded on the call)
      if (phone && smsOk) {
        await db("rx_sms_optins", { method: "POST", body: JSON.stringify({ phone, name: a.customer_name || null, business_slug: b.slug, service_texts: true, promo_texts: false, source: "verbal:" + (callId || "call") }) }).catch(() => {});
        const ok = await sms(phone, `${b.name}: you're booked for ${when}. Issue: ${a.issue}. ${fee ? `Dispatch fee ${money(fee)}. ` : ""}The tech will text when he's on the way. Reply STOP to opt out, HELP for help.`);
        if (ok) await db(`rx_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ customer_texted: true }) });
      }
      // text the owner right away (don't wait for end-of-call)
      await sms(b.owner_phone, `NEW JOB (${(a.urgency || "standard").toUpperCase()}) — ${a.customer_name}, ${a.address}${a.zip ? " " + a.zip : ""}\n${a.issue}\n${when}\nCallback: ${phone || "unknown"}${a.notes ? "\nNotes: " + a.notes : ""}`);
      return `Booked. Job ${job.id.slice(0, 8)} for ${when}. ${smsOk ? "Tell the caller they'll get a text confirmation now." : "Read the window back to the caller since they declined texts."}`;
    }
    case "take_message": {
      await db("rx_messages", { method: "POST", body: JSON.stringify({ business_id: b.id, caller_name: a.caller_name || null, caller_phone: normPhone(a.caller_phone) || callerPhone, body: a.body, callback_pref: a.callback_pref || null }) });
      await sms(b.owner_phone, `MESSAGE for ${b.name} — ${a.caller_name || "caller"} (${normPhone(a.caller_phone) || callerPhone || "no number"}):\n${a.body}${a.callback_pref ? "\nCallback: " + a.callback_pref : ""}`);
      return "Message recorded and texted to the owner. Tell the caller they'll hear back soon.";
    }
    case "out_of_area": {
      await db("rx_messages", { method: "POST", body: JSON.stringify({ business_id: b.id, caller_phone: callerPhone, body: `OUT OF AREA: ${a.zip_or_town} — ${a.issue || ""}`, handled: true }) });
      return "Logged. Politely tell them we don't service that area and wish them luck.";
    }
    default:
      return `Unknown tool ${name}.`;
  }
}

// ---------- end of call ----------
async function endOfCall(b: Business | null, msg: any) {
  const call = msg.call || {};
  const sd = msg.analysis?.structuredData || {};
  const callerPhone = normPhone(call.customer?.number);
  const row = {
    business_id: b?.id || null, vapi_call_id: call.id, caller_phone: callerPhone,
    started_at: msg.startedAt || call.startedAt || null, ended_at: msg.endedAt || call.endedAt || null,
    duration_s: msg.durationSeconds ? Math.round(msg.durationSeconds) : null,
    outcome: sd.outcome || null, urgency: sd.urgency || null, summary: msg.analysis?.summary || msg.summary || null,
    transcript: msg.artifact?.transcript || msg.transcript || null, recording_url: msg.artifact?.recordingUrl || msg.recordingUrl || null,
    ended_reason: msg.endedReason || null, raw: { analysis: msg.analysis, endedReason: msg.endedReason },
  };
  const [saved] = await db<any[]>("rx_calls?on_conflict=vapi_call_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
  if (saved?.id && call.id) {
    await db(`rx_jobs?vapi_call_id=eq.${encodeURIComponent(call.id)}`, { method: "PATCH", body: JSON.stringify({ call_id: saved.id }) }).catch(() => {});
  }
  // Missed call: owner is alerted. The caller is only texted back if they have previously opted in (rx_sms_optins).
  const short = (row.duration_s ?? 0) < 12;
  const abandoned = short || row.outcome === "abandoned" || /no-answer|did-not-answer|silence|pipeline-error|voicemail/i.test(row.ended_reason || "");
  let textedBack = false;
  if (b && callerPhone && abandoned && !["booked", "message"].includes(row.outcome || "")) {
    const optin = await db<any[]>(`rx_sms_optins?phone=eq.${encodeURIComponent(callerPhone)}&service_texts=is.true&limit=1`).catch(() => []);
    if (optin.length) {
      textedBack = await sms(callerPhone, `Hey, this is ${b.name} — sorry we missed you! Text us what's going on (or call back anytime) and we'll get you on the schedule. Reply STOP to opt out.`);
      if (textedBack && saved?.id) await db(`rx_calls?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ caller_texted: true }) });
    }
  }
  // Owner gets a summary for anything that wasn't already texted as a job/message
  const to = b?.owner_phone || cfg("OWNER_FALLBACK_PHONE");
  if (to && (row.summary || abandoned) && !["booked", "message"].includes(row.outcome || "")) {
    const ok = await sms(to, abandoned
      ? `MISSED CALL ${callerPhone || "(unknown number)"} — hung up before booking. ${textedBack ? "We texted them back." : "Call them back."}`
      : `CALL (${row.outcome || "ended"}) ${callerPhone || ""} — ${row.summary}`);
    if (ok && saved?.id) await db(`rx_calls?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ owner_notified: true }) });
  }
}

// ---------- main ----------
Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ ok: true, service: "rx-agent" });
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  await loadConfig();
  const secret = cfg("VAPI_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-vapi-secret") !== secret) return new Response("unauthorized", { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const msg = body.message || body;
  const type = msg.type;

  try {
    if (type === "assistant-request") {
      const b = await findBusiness(msg);
      if (!b) return json({ error: "No business is set up for this number yet. Please call back later." });
      const [svcs, oc] = await Promise.all([services(b), onCall(b)]);
      return json({ assistant: assistantFor(b, svcs, oc) });
    }

    if (type === "tool-calls" || type === "function-call") {
      const b = await findBusiness(msg);
      if (!b) return json({ results: [] });
      const callerPhone = normPhone(msg.call?.customer?.number);
      const list = msg.toolCallList || msg.toolWithToolCallList?.map((t: any) => t.toolCall) || (msg.functionCall ? [{ id: msg.functionCall.id || "fc", function: msg.functionCall }] : []);
      const results = [];
      for (const tc of list) {
        const fn = tc.function || tc;
        let args = fn.arguments ?? fn.parameters ?? {};
        if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
        const result = await handleTool(b, fn.name, args, msg.call?.id, callerPhone).catch(e => `Error: ${e.message}`);
        results.push({ toolCallId: tc.id, name: fn.name, result });
      }
      return json({ results });
    }

    if (type === "transfer-destination-request") {
      const b = await findBusiness(msg);
      const oc = b ? await onCall(b) : [];
      const today = b ? weekdayNum(new Date(), b.timezone) : new Date().getDay();
      const pick = oc.find(o => o.days.includes(today)) || oc[0];
      const number = pick?.phone || b?.transfer_number || b?.owner_phone || cfg("OWNER_FALLBACK_PHONE");
      if (!number) return json({ error: "No transfer destination configured." });
      return json({ destination: { type: "number", number, message: `Connecting you to ${pick?.name || "the on-call tech"} now.` } });
    }

    if (type === "end-of-call-report") {
      const b = await findBusiness(msg);
      await endOfCall(b, msg);
      return json({ ok: true });
    }

    // status-update, speech-update, hang, etc.
    return json({ ok: true, ignored: type });
  } catch (e) {
    console.error("rx-agent error", type, e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
