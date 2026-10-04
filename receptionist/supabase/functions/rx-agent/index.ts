import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// TB Solutions AI Receptionist — Vapi server webhook
// One function serves every client, and every client can run as many AI phone agents as it wants.
// The AGENT is resolved from the number the caller dialed (rx_agents.phone_number); the business
// comes along with it. Each agent has its own role, persona, voice, hours and notify phone, and
// anything it doesn't set falls back to the rx_businesses row.
//
// Vapi sends everything to this URL (set as the phone number's serverUrl):
//   assistant-request        → we return THAT agent's prompt, tools and voice
//   tool-calls               → check_availability / book_job / take_message / out_of_area
//   end-of-call-report       → store call (with agent_id), text whoever that line notifies
//   transfer-destination-request → who to live-transfer to (on-call tech)
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPI_WEBHOOK_SECRET   shared secret; Vapi sends it as x-vapi-secret
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   for SMS (same names as chalk/)
//   OWNER_FALLBACK_PHONE  optional: where to text if a call hits an unknown number (your cell)

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
const WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET") || "";
const TW_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TW_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TW_FROM = Deno.env.get("TWILIO_FROM") || "";
const FALLBACK_PHONE = Deno.env.get("OWNER_FALLBACK_PHONE") || "";

type Hours = Record<string, [string, string] | null>;
type Business = {
  id: string; slug: string; name: string; trade: string; owner_name: string | null; owner_phone: string;
  agent_number: string | null; agent_name: string; timezone: string; service_zips: string[]; service_area_note: string | null;
  service_fee_cents: number | null; after_hours_fee_cents: number | null; free_estimates: boolean;
  hours: Hours; windows: [string, string][]; jobs_per_window: number;
  emergency_policy: string; transfer_number: string | null; knowledge: string | null; active: boolean;
};
type Agent = {
  id: string | null; business_id: string; slug: string; label: string | null; role: string; agent_name: string;
  phone_number: string | null; greeting: string | null; prompt_extra: string | null; tools_allow: string[] | null;
  voice: Record<string, unknown> | null; model: Record<string, unknown> | null;
  hours: Hours | null; windows: [string, string][] | null; jobs_per_window: number | null;
  emergency_policy: string | null; transfer_number: string | null; notify_phone: string | null;
  priority: number; active: boolean;
};
type Service = { id: string; name: string; keywords: string[]; urgency: string; fee_cents: number | null; safety_steps: string | null };
type OnCall = { name: string; phone: string; days: number[]; priority: number };
type Line = { b: Business; a: Agent };

// ---------- helpers ----------
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const enc = encodeURIComponent;

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
function isAfterHours(hours: Hours, tz: string, now = new Date()): boolean {
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekdayNum(now, tz)];
  const h = hours?.[key];
  if (!h) return true;
  const today = localDateStr(now, tz);
  const open = zonedToUtc(today, h[0], tz), close = zonedToUtc(today, h[1], tz);
  return now < open || now >= close;
}

async function sms(to: string, body: string): Promise<boolean> {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) { console.log("[sms disabled]", to, body); return false; }
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${TW_SID}:${TW_TOKEN}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TW_FROM, Body: body }),
  });
  if (!r.ok) { console.error("twilio", r.status, await r.text()); return false; }
  return true;
}

// ---------- the line: one business + the agent that answered ----------
// Anything the agent leaves null falls back to the business, so a one-line client needs no agent config.
function eff(b: Business, a: Agent) {
  return {
    hours: a.hours ?? b.hours,
    windows: a.windows ?? b.windows,
    jobsPerWindow: a.jobs_per_window ?? b.jobs_per_window,
    emergencyPolicy: a.emergency_policy || b.emergency_policy,
    transferNumber: a.transfer_number || b.transfer_number || b.owner_phone,
    notifyPhone: a.notify_phone || b.owner_phone,
    lineName: a.label || a.slug,
  };
}

// A business with no rx_agents row still answers: synthesize its legacy 'main' line.
function legacyAgent(b: Business): Agent {
  return {
    id: null, business_id: b.id, slug: "main", label: "Main line", role: "receptionist", agent_name: b.agent_name,
    phone_number: b.agent_number, greeting: null, prompt_extra: null, tools_allow: null, voice: null, model: null,
    hours: null, windows: null, jobs_per_window: null, emergency_policy: null, transfer_number: null, notify_phone: null,
    priority: 1, active: true,
  };
}

const bizById = (id: string) => db<Business[]>(`rx_businesses?id=eq.${enc(id)}&active=is.true&limit=1`).then(r => r[0] || null);
const bizBySlug = (slug: string) => db<Business[]>(`rx_businesses?slug=eq.${enc(slug)}&active=is.true&limit=1`).then(r => r[0] || null);

async function agentFor(b: Business, slug?: string): Promise<Agent> {
  const q = slug
    ? `rx_agents?business_id=eq.${enc(b.id)}&slug=eq.${enc(slug)}&active=is.true&limit=1`
    : `rx_agents?business_id=eq.${enc(b.id)}&active=is.true&order=priority&limit=1`;
  const rows = await db<Agent[]>(q);
  return rows[0] || legacyAgent(b);
}

// Resolution order: dialed number → rx_agents, then slugs passed in metadata, then the legacy
// rx_businesses.agent_number column, then the demo line so a stray call still gets answered.
async function resolve(msg: any): Promise<Line | null> {
  const dialed = normPhone(msg?.call?.phoneNumber?.number || msg?.phoneNumber?.number);
  const vars = msg?.call?.assistantOverrides?.variableValues || {};
  const meta = { ...(msg?.assistant?.metadata || {}), ...(msg?.call?.metadata || {}) };
  const bizSlug: string | undefined = vars.business_slug || meta.business_slug;
  const agentSlug: string | undefined = vars.agent_slug || meta.agent_slug;

  if (dialed) {
    const [a] = await db<Agent[]>(`rx_agents?phone_number=eq.${enc(dialed)}&active=is.true&limit=1`);
    if (a) {
      const b = await bizById(a.business_id);
      if (b) return { b, a };
    }
  }
  if (bizSlug) {
    const b = await bizBySlug(bizSlug);
    if (b) return { b, a: await agentFor(b, agentSlug) };
  }
  if (dialed) {
    const [b] = await db<Business[]>(`rx_businesses?agent_number=eq.${enc(dialed)}&active=is.true&limit=1`);
    if (b) return { b, a: await agentFor(b, agentSlug) };
  }
  const demo = await bizBySlug("demo");
  return demo ? { b: demo, a: await agentFor(demo, agentSlug) } : null;
}

const services = (b: Business) => db<Service[]>(`rx_services?business_id=eq.${b.id}&active=is.true&order=urgency`);
const onCall = (b: Business) => db<OnCall[]>(`rx_on_call?business_id=eq.${b.id}&order=priority`);

// ---------- availability ----------
// Windows and hours can be per-agent, but capacity is counted across the WHOLE business —
// every line books the same crew, so two agents can never double-sell one truck.
async function availability({ b, a }: Line, date: string) {
  const f = eff(b, a);
  const key = weekdayKey(date, b.timezone);
  const h = f.hours?.[key];
  if (!h) return { date, open: false, slots: [] as any[] };
  const dayStart = zonedToUtc(date, "00:00", b.timezone), dayEnd = zonedToUtc(date, "23:59", b.timezone);
  const booked = await db<{ window_start: string }[]>(`rx_jobs?business_id=eq.${b.id}&status=in.(scheduled,confirmed,en_route)&window_start=gte.${dayStart.toISOString()}&window_start=lte.${dayEnd.toISOString()}&select=window_start`);
  const counts = new Map<string, number>();
  for (const j of booked) counts.set(j.window_start, (counts.get(j.window_start) || 0) + 1);
  const now = new Date();
  const slots = (f.windows || []).map(([s, e]) => {
    const ws = zonedToUtc(date, s, b.timezone), we = zonedToUtc(date, e, b.timezone);
    const used = counts.get(ws.toISOString()) || 0;
    return { start: ws.toISOString(), end: we.toISOString(), label: fmtWindow(ws, we, b.timezone), open: ws > now && used < f.jobsPerWindow && s >= h[0] && e <= h[1] };
  }).filter(s => s.open);
  return { date, open: true, slots };
}

// ---------- roles ----------
// A role is what the line is FOR. It picks the mission, the greeting, and which tools exist.
const ROLE_KEYS = ["receptionist", "booking", "emergency", "support", "overflow", "estimates"] as const;
type Role = typeof ROLE_KEYS[number];
const roleOf = (a: Agent): Role => (ROLE_KEYS as readonly string[]).includes(a.role) ? a.role as Role : "receptionist";

type Ctx = { feeLine: string; ahLine: string; estimateLine: string; afterHours: boolean };

function receptionistMission(_b: Business, _a: Agent, c: Ctx): string {
  return `YOUR JOB, IN ORDER:
1. Greet briefly and find out what's going on. One question at a time. Short sentences. No lists.
2. If it's an emergency (active leak you can't stop, sewage backup, gas smell, no heat in freezing weather, sparking/burning smell), give the SAFETY step for that issue first, then move fast to booking. Gas smell or sparking: tell them to leave the house and call 911 or the gas company, then still take their info.
3. Confirm they're in our service area (ask for the zip or town if unsure). If out of area, call out_of_area and politely let them go.
4. State the fee plainly when relevant (${c.feeLine} ${c.ahLine}). ${c.estimateLine} NEVER quote a full job price. Say: "the tech will give you an exact price before any work starts."
5. Call check_availability for the day they want, offer at most two windows, and book with book_job. Get: full name, address, zip, best callback number (confirm the number they're calling from), and a one-line description of the issue.
6. After booking, tell them they'll get a text confirmation and that the tech will text when he's on the way. Then end the call warmly.`;
}

const ROLES: Record<Role, {
  tools: string[];
  greeting: (b: Business, a: Agent) => string;
  endMessage: string;
  mission: (b: Business, a: Agent, c: Ctx) => string;
}> = {
  receptionist: {
    tools: ["check_availability", "book_job", "take_message", "out_of_area"],
    greeting: (b, a) => `Thanks for calling ${b.name}, this is ${a.agent_name}. What's going on?`,
    endMessage: "Alright, you're all set. Talk soon.",
    mission: receptionistMission,
  },

  overflow: {
    tools: ["check_availability", "book_job", "take_message", "out_of_area"],
    greeting: (b, a) => `Thanks for holding — this is ${a.agent_name} with ${b.name}. What's going on?`,
    endMessage: "Alright, you're all set. Thanks for your patience.",
    mission: (b, a, c) => `This caller rolled over to you because the main line was busy. Never say "overflow" or that someone else couldn't pick up — just help them.

${receptionistMission(b, a, c)}`,
  },

  booking: {
    tools: ["check_availability", "book_job", "take_message", "out_of_area"],
    greeting: (b, a) => `Thanks for calling ${b.name}, this is ${a.agent_name}. What can we get on the schedule for you?`,
    endMessage: "You're on the schedule. Talk soon.",
    mission: (_b, _a, c) => `THIS LINE BOOKS WORK. Assume the caller wants an appointment.

YOUR JOB, IN ORDER:
1. Greet briefly and find out what needs doing. One question at a time. Short sentences. No lists.
2. If it's an emergency (active leak you can't stop, sewage backup, gas smell, no heat in freezing weather, sparking/burning smell), give the SAFETY step for that issue first, then get them into the soonest window. Gas smell or sparking: tell them to leave the house and call 911 or the gas company, then still take their info.
3. Confirm they're in our service area (ask for the zip or town if unsure). If out of area, call out_of_area and politely let them go.
4. State the fee plainly when relevant (${c.feeLine} ${c.ahLine}). ${c.estimateLine} NEVER quote a full job price. Say: "the tech will give you an exact price before any work starts."
5. Call check_availability for the day they want, offer at most two windows, and book with book_job. Get: full name, address, zip, best callback number, and a one-line description of the issue.
6. If they already have a job on the books, an invoice question, or anything you cannot book, use take_message and tell them the office will call right back. Do not try to solve it yourself.
7. After booking, tell them they'll get a text confirmation and that the tech will text when he's on the way. Then end the call warmly.`,
  },

  emergency: {
    tools: ["check_availability", "book_job", "take_message", "transfer_call"],
    greeting: (b, a) => `${b.name} emergency line, this is ${a.agent_name}. What's going on?`,
    endMessage: "Help is on the way. Keep that valve shut off until the tech gets there.",
    mission: (_b, _a, c) => `YOU ARE THE AFTER-HOURS EMERGENCY LINE. Something is probably happening right now. Be calm, fast and short.

YOUR JOB, IN ORDER:
1. One short greeting, then ask what's happening.
2. SAFETY FIRST, before booking anything. Give the shut-off or safety step for their issue. Gas smell or sparking/burning: tell them to leave the house and call 911 or the gas company, then still take their info.
3. Decide fast whether this can wait until morning.
   - Can't wait, and transfer_call is available → say "hang on, I'm getting the on-call tech on the line" and transfer.
   - Can't wait, no transfer → book_job for the soonest window and tell them the tech will call back within 15 minutes.
   - Can wait → offer the first window tomorrow with check_availability and book it, or take_message if they'd rather be called back.
4. Say the after-hours fee plainly before you dispatch anyone (${c.ahLine || c.feeLine}). NEVER quote a full job price — the tech prices it on site.
5. Get name, address, zip and callback number even when you're about to transfer. If the call drops, that's all the tech has.`,
  },

  support: {
    tools: ["take_message"],
    greeting: (b, a) => `Thanks for calling ${b.name}, this is ${a.agent_name}. Do you have a job with us already?`,
    endMessage: "I've got it written down and sent over. Someone will get back to you.",
    mission: () => `YOU ARE THE EXISTING-CUSTOMER LINE. You do NOT book new work and you do NOT quote prices. Your whole job is getting the facts down so the owner can act without calling the customer back.

YOUR JOB, IN ORDER:
1. Greet briefly. Get their name and the address the work was done at.
2. Find out what they need: where a scheduled job stands, a tech running late, an invoice or payment question, a warranty or callback, or a complaint.
3. Write it down with take_message — specific enough to act on. Always include the address, the best callback number, and when they want to be called.
4. If they want NEW work, don't book it. Say the office will call them right back to schedule, and log it with take_message.
5. If they're upset: stay calm, apologize once, and do not promise a refund, a discount, or a specific arrival time — the owner decides that. Offer transfer_call only if it is available to you.`,
  },

  estimates: {
    tools: ["check_availability", "book_job", "take_message", "out_of_area"],
    greeting: (b, a) => `Thanks for calling ${b.name}, this is ${a.agent_name}. What are you looking at replacing?`,
    endMessage: "You're set for the estimate. Talk soon.",
    mission: (_b, _a, c) => `YOU ARE THE ESTIMATES LINE — replacements, installs and remodels, not repairs.

YOUR JOB, IN ORDER:
1. Greet briefly and find out what they want replaced or installed.
2. Ask what's there now, roughly how old it is, and whether anything is actively leaking or out of service. If it is, that's a repair: give the safety step and book the soonest window instead.
3. Confirm they're in our service area (ask for the zip or town if unsure). If out of area, call out_of_area and politely let them go.
4. ${c.estimateLine} Book the estimate visit with check_availability and book_job, urgency "estimate". Get: full name, address, zip, best callback number, and one line on what they want done.
5. NEVER give a price, a range, or a ballpark, even if they push twice. Say: "the tech prices it on site, and the estimate itself is free." ${c.feeLine}
6. Anything that isn't an estimate — existing job, invoice, warranty — goes to take_message.`,
  },
};

// Which tools this agent actually gets. tools_allow can only narrow the role's set.
function toolNames(b: Business, a: Agent): string[] {
  const f = eff(b, a);
  const role = roleOf(a);
  let names = [...ROLES[role].tools];
  if (!names.includes("transfer_call") && f.emergencyPolicy === "transfer") names.push("transfer_call");
  if (a.tools_allow?.length) names = names.filter(n => a.tools_allow!.includes(n));
  return names;
}

// ---------- assistant config (assistant-request) ----------
function systemPrompt({ b, a }: Line, svcs: Service[], oc: OnCall[]): string {
  const f = eff(b, a);
  const now = new Date();
  const afterHours = isAfterHours(f.hours, b.timezone, now);
  const today = new Intl.DateTimeFormat("en-US", { timeZone: b.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  const ctx: Ctx = {
    feeLine: b.service_fee_cents ? `Standard service call / dispatch fee: ${money(b.service_fee_cents)}.` : "Service call fee: ask the owner (say you'll have the tech confirm the dispatch fee when he calls).",
    ahLine: b.after_hours_fee_cents ? `After-hours / weekend dispatch fee: ${money(b.after_hours_fee_cents)}.` : "",
    estimateLine: b.free_estimates ? "Estimates for replacements and new installs are free." : "We charge for estimates; tell them the tech will quote the estimate fee.",
    afterHours,
  };
  const svcLines = svcs.map(s => `- ${s.name} [${s.urgency}${s.fee_cents ? `, ${money(s.fee_cents)}` : ""}]${s.keywords.length ? ` (callers say: ${s.keywords.join(", ")})` : ""}${s.safety_steps ? ` — SAFETY FIRST: ${s.safety_steps}` : ""}`).join("\n");
  const ocLine = oc.length ? `On-call today: ${oc.filter(o => o.days.includes(weekdayNum(now, b.timezone))).map(o => o.name).join(", ") || oc[0].name}.` : "";
  const zipLine = b.service_zips?.length ? `We serve these zip codes: ${b.service_zips.join(", ")}. ${b.service_area_note || ""}`.trim() : (b.service_area_note ? `Service area: ${b.service_area_note}` : "");
  const policy = f.emergencyPolicy === "transfer"
    ? "For emergencies, use transfer_call to connect the caller live to the on-call tech."
    : f.emergencyPolicy === "message_only"
      ? "For emergencies after hours, take a detailed message with take_message and tell the caller the on-call tech will call back within 15 minutes."
      : "For emergencies after hours, offer same-night dispatch at the after-hours fee or first window tomorrow morning, and book it with book_job.";
  const allowed = toolNames(b, a);

  return `You are ${a.agent_name}, answering the ${f.lineName} for ${b.name}, a ${b.trade} company. You answer the phone like a sharp, friendly dispatcher who has worked there for years. You are NOT a generic assistant.

CURRENT TIME: ${today} (${b.timezone}). ${afterHours ? "This line is outside its posted hours right now." : "This line is open right now."}

${ROLES[roleOf(a)].mission(b, a, ctx)}

RULES:
- Keep every reply under 2 sentences unless giving a safety step. Sound human: contractions, "got it", "okay". No corporate phrasing.
- If asked if you're a real person or an AI, say honestly: "I'm ${b.name}'s automated assistant, but I can help you right now." Never claim to be human.
- Don't make things up. If you don't know (brands serviced, warranty, pricing), say "I'd have the tech confirm that" and offer to note it on the job.
- If the caller is a vendor, salesperson, or robocall, politely end the call.
- Never read phone numbers or addresses back more than once; confirm once, briefly.
- You have exactly these tools: ${allowed.join(", ") || "none"}. If the caller needs something outside them, say the office will call them right back${allowed.includes("take_message") ? " and use take_message" : ""} — never invent a capability.
- ${policy} ${ocLine}

SERVICES WE HANDLE:
${svcLines || "- General " + b.trade + " service, repairs, and installs."}

SERVICE AREA: ${zipLine || "Ask for the town; we serve the local area."}

THINGS TO KNOW ABOUT ${b.name.toUpperCase()}:
${b.knowledge || "(none provided yet)"}${a.prompt_extra ? `

ABOUT THIS LINE SPECIFICALLY:
${a.prompt_extra}` : ""}`;
}

function tools({ b, a }: Line) {
  const f = eff(b, a);
  const names = toolNames(b, a);
  const defs: Record<string, any> = {
    check_availability: { type: "function", async: false, function: { name: "check_availability", description: "Get open arrival windows for a date. Call before offering times.", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD in the business time zone. Today, tomorrow, or a specific date the caller asked for." } }, required: ["date"] } } },
    book_job: { type: "function", async: false, function: { name: "book_job", description: "Book the visit once you have name, address, zip, callback number, issue, and the chosen window.", parameters: { type: "object", properties: {
      customer_name: { type: "string" }, customer_phone: { type: "string" }, address: { type: "string" }, zip: { type: "string" },
      issue: { type: "string", description: "One line: what's wrong, in the caller's words." },
      urgency: { type: "string", enum: ["emergency", "urgent", "standard", "estimate"] },
      window_start: { type: "string", description: "ISO start from check_availability" }, window_end: { type: "string", description: "ISO end from check_availability" },
      notes: { type: "string", description: "Gate code, dog, parking, anything the tech should know." } }, required: ["customer_name", "customer_phone", "address", "issue", "urgency", "window_start", "window_end"] } } },
    take_message: { type: "function", async: false, function: { name: "take_message", description: "Record a message for the owner when booking isn't right (existing job question, complaint, wants the owner, commercial bid).", parameters: { type: "object", properties: { caller_name: { type: "string" }, caller_phone: { type: "string" }, body: { type: "string" }, callback_pref: { type: "string", description: "When they want a callback" } }, required: ["caller_phone", "body"] } } },
    out_of_area: { type: "function", async: false, function: { name: "out_of_area", description: "Log that a caller was outside the service area.", parameters: { type: "object", properties: { zip_or_town: { type: "string" }, issue: { type: "string" } }, required: ["zip_or_town"] } } },
    transfer_call: { type: "transferCall", destinations: [{ type: "number", number: f.transferNumber, message: "Hang on one second, I'm connecting you to our on-call tech now." }], function: { name: "transfer_call", description: "Connect the caller live to the on-call technician. Emergencies and escalations only." } },
  };
  return names.map(n => defs[n]).filter(Boolean);
}

function assistantFor(line: Line, svcs: Service[], oc: OnCall[]) {
  const { b, a } = line;
  const f = eff(b, a);
  const role = roleOf(a);
  return {
    name: `${b.name} — ${a.agent_name} (${f.lineName})`,
    firstMessage: a.greeting || ROLES[role].greeting(b, a),
    model: { provider: "openai", model: "gpt-4o", temperature: 0.4, ...(a.model || {}), messages: [{ role: "system", content: systemPrompt(line, svcs, oc) }], tools: tools(line) },
    voice: a.voice || { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM", stability: 0.5, similarityBoost: 0.75 },
    transcriber: { provider: "deepgram", model: "nova-2-phonecall", language: "en" },
    silenceTimeoutSeconds: 20,
    maxDurationSeconds: 900,
    backgroundSound: "off",
    endCallMessage: ROLES[role].endMessage,
    endCallPhrases: ["goodbye", "bye now", "talk soon"],
    serverMessages: ["tool-calls", "end-of-call-report", "transfer-destination-request", "status-update"],
    analysisPlan: {
      summaryPrompt: `Summarize this call to ${b.name}'s ${f.lineName} for a busy contractor in 2 sentences: who called, what's wrong, what happened (booked/message/out of area/other), and anything the tech must know.`,
      structuredDataSchema: { type: "object", properties: { outcome: { type: "string", enum: ["booked", "message", "transferred", "out_of_area", "info_only", "spam", "abandoned"] }, urgency: { type: "string", enum: ["emergency", "urgent", "standard", "estimate", "none"] } } },
    },
    metadata: { business_slug: b.slug, business_id: b.id, agent_slug: a.slug, agent_id: a.id, agent_role: role },
  };
}

// ---------- tool handlers ----------
async function handleTool(line: Line, name: string, a: any, callId: string | undefined, callerPhone: string | null): Promise<string> {
  const { b, a: agent } = line;
  const f = eff(b, agent);
  // Belt and braces: the model only sees this line's tools, but never let it act outside them.
  if (!toolNames(b, agent).includes(name)) return `This line can't do that. Tell the caller the office will call them right back.`;

  switch (name) {
    case "check_availability": {
      const date = a.date || localDateStr(new Date(), b.timezone);
      const r = await availability(line, date);
      if (!r.open) return `We're closed on ${date}. Offer the next business day instead.`;
      if (!r.slots.length) return `No open windows left on ${date}. Offer the next day.`;
      return `Open windows on ${date}: ` + r.slots.map(s => `${s.label} (start=${s.start}, end=${s.end})`).join("; ") + ". Offer at most two.";
    }
    case "book_job": {
      const phone = normPhone(a.customer_phone) || callerPhone;
      const svcs = await services(b);
      const issue = String(a.issue || "").toLowerCase();
      const svc = svcs.find(s => s.keywords.some(k => issue.includes(k.toLowerCase())) || issue.includes(s.name.toLowerCase()));
      const urgency = a.urgency || svc?.urgency || "standard";
      // A free estimate visit is free — don't text the customer a dispatch fee for one.
      const fee = (urgency === "estimate" && b.free_estimates)
        ? null
        : svc?.fee_cents ?? (isAfterHours(f.hours, b.timezone) ? b.after_hours_fee_cents : b.service_fee_cents) ?? null;
      const [job] = await db<any[]>("rx_jobs", { method: "POST", body: JSON.stringify({
        business_id: b.id, agent_id: agent.id, vapi_call_id: callId, customer_name: a.customer_name, customer_phone: phone, address: a.address, zip: a.zip,
        issue: a.issue, service_id: svc?.id || null, urgency, window_start: a.window_start, window_end: a.window_end,
        quoted_fee_cents: fee, notes: a.notes || null, status: "scheduled" }) });
      const ws = new Date(a.window_start), we = new Date(a.window_end);
      const when = fmtWindow(ws, we, b.timezone);
      // text the customer
      if (phone) {
        const ok = await sms(phone, `${b.name}: you're booked for ${when}. Issue: ${a.issue}. ${fee ? `Dispatch fee ${money(fee)}. ` : ""}The tech will text when he's on the way. Reply STOP to opt out.`);
        if (ok) await db(`rx_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ customer_texted: true }) });
      }
      // text whoever this line reports to, right away (don't wait for end-of-call)
      await sms(f.notifyPhone, `NEW JOB (${urgency.toUpperCase()}) via ${f.lineName} — ${a.customer_name}, ${a.address}${a.zip ? " " + a.zip : ""}\n${a.issue}\n${when}\nCallback: ${phone || "unknown"}${a.notes ? "\nNotes: " + a.notes : ""}`);
      return `Booked. Job ${job.id.slice(0, 8)} for ${when}. Tell the caller they'll get a text confirmation now.`;
    }
    case "take_message": {
      await db("rx_messages", { method: "POST", body: JSON.stringify({ business_id: b.id, agent_id: agent.id, caller_name: a.caller_name || null, caller_phone: normPhone(a.caller_phone) || callerPhone, body: a.body, callback_pref: a.callback_pref || null }) });
      await sms(f.notifyPhone, `MESSAGE via ${f.lineName} — ${a.caller_name || "caller"} (${normPhone(a.caller_phone) || callerPhone || "no number"}):\n${a.body}${a.callback_pref ? "\nCallback: " + a.callback_pref : ""}`);
      return "Message recorded and texted over. Tell the caller they'll hear back soon.";
    }
    case "out_of_area": {
      await db("rx_messages", { method: "POST", body: JSON.stringify({ business_id: b.id, agent_id: agent.id, caller_phone: callerPhone, body: `OUT OF AREA: ${a.zip_or_town} — ${a.issue || ""}`, handled: true }) });
      return "Logged. Politely tell them we don't service that area and wish them luck.";
    }
    default:
      return `Unknown tool ${name}.`;
  }
}

// ---------- end of call ----------
async function endOfCall(line: Line | null, msg: any) {
  const call = msg.call || {};
  const sd = msg.analysis?.structuredData || {};
  const callerPhone = normPhone(call.customer?.number);
  const f = line ? eff(line.b, line.a) : null;
  const row = {
    business_id: line?.b.id || null, agent_id: line?.a.id || null, vapi_call_id: call.id, caller_phone: callerPhone,
    started_at: msg.startedAt || call.startedAt || null, ended_at: msg.endedAt || call.endedAt || null,
    duration_s: msg.durationSeconds ? Math.round(msg.durationSeconds) : null,
    outcome: sd.outcome || null, urgency: sd.urgency || null, summary: msg.analysis?.summary || msg.summary || null,
    transcript: msg.artifact?.transcript || msg.transcript || null, recording_url: msg.artifact?.recordingUrl || msg.recordingUrl || null,
    ended_reason: msg.endedReason || null, raw: { analysis: msg.analysis, endedReason: msg.endedReason, agent_slug: line?.a.slug || null },
  };
  const [saved] = await db<any[]>("rx_calls?on_conflict=vapi_call_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
  if (saved?.id && call.id) {
    await db(`rx_jobs?vapi_call_id=eq.${enc(call.id)}`, { method: "PATCH", body: JSON.stringify({ call_id: saved.id }) }).catch(() => {});
  }
  // This line's notify phone gets a summary for anything that wasn't already texted as a job/message
  const to = f?.notifyPhone || FALLBACK_PHONE;
  if (to && row.summary && !["booked", "message"].includes(row.outcome || "")) {
    const ok = await sms(to, `CALL (${row.outcome || "ended"}) via ${f?.lineName || "unknown line"} ${callerPhone || ""} — ${row.summary}`);
    if (ok && saved?.id) await db(`rx_calls?id=eq.${saved.id}`, { method: "PATCH", body: JSON.stringify({ owner_notified: true }) });
  }
}

// ---------- main ----------
Deno.serve(async (req: Request) => {
  if (req.method === "GET") return json({ ok: true, service: "rx-agent" });
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (WEBHOOK_SECRET && req.headers.get("x-vapi-secret") !== WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const msg = body.message || body;
  const type = msg.type;

  try {
    if (type === "assistant-request") {
      const line = await resolve(msg);
      if (!line) return json({ error: "No business is set up for this number yet. Please call back later." });
      const [svcs, oc] = await Promise.all([services(line.b), onCall(line.b)]);
      return json({ assistant: assistantFor(line, svcs, oc) });
    }

    if (type === "tool-calls" || type === "function-call") {
      const line = await resolve(msg);
      if (!line) return json({ results: [] });
      const callerPhone = normPhone(msg.call?.customer?.number);
      const list = msg.toolCallList || msg.toolWithToolCallList?.map((t: any) => t.toolCall) || (msg.functionCall ? [{ id: msg.functionCall.id || "fc", function: msg.functionCall }] : []);
      const results = [];
      for (const tc of list) {
        const fn = tc.function || tc;
        let args = fn.arguments ?? fn.parameters ?? {};
        if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
        const result = await handleTool(line, fn.name, args, msg.call?.id, callerPhone).catch(e => `Error: ${e.message}`);
        results.push({ toolCallId: tc.id, name: fn.name, result });
      }
      return json({ results });
    }

    if (type === "transfer-destination-request") {
      const line = await resolve(msg);
      const oc = line ? await onCall(line.b) : [];
      const today = line ? weekdayNum(new Date(), line.b.timezone) : new Date().getDay();
      const pick = oc.find(o => o.days.includes(today)) || oc[0];
      const number = pick?.phone || (line ? eff(line.b, line.a).transferNumber : null) || FALLBACK_PHONE;
      if (!number) return json({ error: "No transfer destination configured." });
      return json({ destination: { type: "number", number, message: `Connecting you to ${pick?.name || "the on-call tech"} now.` } });
    }

    if (type === "end-of-call-report") {
      const line = await resolve(msg);
      await endOfCall(line, msg);
      return json({ ok: true });
    }

    // status-update, speech-update, hang, etc.
    return json({ ok: true, ignored: type });
  } catch (e) {
    console.error("rx-agent error", type, e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
