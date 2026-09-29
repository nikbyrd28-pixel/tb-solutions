// Event signup page, staff running a bracket, and the TV showing it.
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/claude-0/-home-claude/773ed295-8285-5277-bc9f-f3cd20a70b26/scratchpad/shots";
mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString().slice(-6);
const api = async (ctx, method, path, body) => (await ctx.request.fetch(BASE + path, { method, data: body ? JSON.stringify(body) : undefined, headers: { "Content-Type": "application/json" } })).json();

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const admin = await browser.newContext(phone);
await api(admin, "POST", "/api/admin/login", { password: process.env.ADMIN_PASSWORD || "letmein" });
const v = await api(admin, "POST", "/api/admin/venue", { name: `Corner Pocket ${stamp}`, city: "Pottstown", owner_name: "Dee", owner_phone: `610888${stamp.slice(0, 4)}`, tables: 2, boards: 0, prize_mode: "cash", free_days: 0 });
const owner = await browser.newContext(phone);
await api(owner, "POST", "/api/staff/login", { phone: `610888${stamp.slice(0, 4)}`, pin: "2468" });
const ev = await api(owner, "POST", "/api/owner/event", { name: "Thursday 8-ball", game: "pool", format: "single_elim", entry_cents: 1500, capacity: 8, starts_at: new Date(Date.now() + 3600e3).toISOString(), prize_text: "$100 bar tab + bragging rights" });

// six players sign up through the API, one through the UI
const names = ["Mike", "Dana", "Jules", "Rob", "Tay", "Sam"];
for (let i = 0; i < names.length; i++) {
  const c = await browser.newContext(phone);
  await api(c, "POST", "/api/auth/identify", { first_name: names[i], phone: `215${String(100000 + i).slice(-3)}${stamp.slice(0, 4)}` });
  await api(c, "POST", `/api/events/${ev.id}/enter`, {});
}
let i = 20;
const shot = async (page, name) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${i++}-${name}.png` }); console.log("shot", name); };

const nickCtx = await browser.newContext(phone);
const nick = await nickCtx.newPage();
await nick.goto(`${BASE}/e/${ev.id}`);
await nick.waitForSelector("text=Who's signing up?");
await nick.fill('input[placeholder="First name"]', "Nick");
await nick.fill('input[placeholder="(555) 555-5555"]', `215999${stamp.slice(0, 4)}`);
await nick.click("text=Next");
await nick.waitForSelector("text=$15 to enter");
await shot(nick, "event-signup");
await nick.click("button:has-text(\"I'm in\")");
await nick.waitForSelector("text=You're in, Nick");
await shot(nick, "event-in");

const op = await owner.newPage();
await op.goto(`${BASE}/e/${ev.id}?staff=1`);
await op.waitForSelector("text=Start the bracket");
await shot(op, "event-staff-checkin");
await op.click('button:has-text("Start the bracket")');
await op.waitForTimeout(2500);
await shot(op, "event-after-start");
await op.waitForSelector("text=Quarters", { timeout: 8000 });
await shot(op, "event-staff-bracket");

const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
await tv.goto(`${BASE}/tv/${v.slug}`);
await tv.waitForSelector("text=Thursday 8-ball");
await shot(tv, "tv-bracket");
await browser.close();
console.log("done");
