// Screenshots of the phone screens a player, a bartender and an owner actually see. Demo mode.
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/tmp/claude-0/-home-claude/773ed295-8285-5277-bc9f-f3cd20a70b26/scratchpad/shots";
mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString().slice(-6);

const api = async (ctx, method, path, body) => {
  const r = await ctx.request.fetch(BASE + path, { method, data: body ? JSON.stringify(body) : undefined, headers: { "Content-Type": "application/json" } });
  return r.json();
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// set up a bar through the API
const admin = await browser.newContext(phone);
await api(admin, "POST", "/api/admin/login", { password: process.env.ADMIN_PASSWORD || "letmein" });
const v = await api(admin, "POST", "/api/admin/venue", { name: `Riverside Tap ${stamp}`, city: "Pottstown", owner_name: "Dee", owner_phone: `610777${stamp.slice(0, 4)}`, tables: 2, boards: 1, prize_mode: "cash", free_days: 30 });
const detail = await api(admin, "GET", `/api/admin/venue/${v.id}`);
const code = detail.stations.find((s) => s.name === "Table 1").code;
await api(admin, "POST", "/api/admin/staff", { venue_id: v.id, name: "Sam", phone: `484777${stamp.slice(0, 4)}`, role: "bartender" });
const samPhone = `484777${stamp.slice(0, 4)}`;
const bart = await browser.newContext(phone);
await api(bart, "POST", "/api/staff/login", { phone: samPhone, pin: "1234" });
await api(bart, "POST", "/api/staff/shift", { on: true });

let i = 0;
const shot = async (page, name) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${String(++i).padStart(2, "0")}-${name}.png`, fullPage: false });
  console.log("shot", name);
};

// ---- player Nick on the table
const nickCtx = await browser.newContext(phone);
const nick = await nickCtx.newPage();
await nick.goto(`${BASE}/t/${code}`);
await nick.waitForSelector("text=Who's playing?");
await shot(nick, "player-identify");
await nick.fill('input[placeholder="First name"]', "Nick");
await nick.fill('input[placeholder="(555) 555-5555"]', `215777${stamp.slice(0, 4)}`);
await nick.click("text=Let's go");
await nick.waitForSelector("text=Play for $5");
await shot(nick, "player-idle");
await nick.click("text=Play for $5");
await nick.waitForSelector("text=Tip your bartender?");
await shot(nick, "player-tip");
await nick.click("text=$2");
await nick.waitForSelector("text=test mode");
await shot(nick, "player-pay");
await nick.click("button:has-text('Pay $7')");
await nick.waitForSelector("text=Waiting on your opponent");
await shot(nick, "player-waiting");

// ---- Mike joins from his phone
const mikeCtx = await browser.newContext(phone);
const mike = await mikeCtx.newPage();
await mike.goto(`${BASE}/t/${code}`);
await mike.fill('input[placeholder="First name"]', "Mike");
await mike.fill('input[placeholder="(555) 555-5555"]', `267777${stamp.slice(0, 4)}`);
await mike.click("text=Let's go");
await mike.waitForSelector("text=Play Nick for $5?");
await shot(mike, "player-join");
await mike.click("text=Join for $5");
await mike.waitForSelector("text=No tip, just play");
await mike.click("text=No tip, just play");
await mike.click("button:has-text('Pay $5')");
await mike.waitForSelector("text=Game on");
await shot(mike, "player-live");

// ---- Nick picks, Mike agrees
await nick.waitForSelector("text=Game on");
await nick.click("text=I won");
await nick.click("text=Tap again: I won");
await nick.waitForSelector("text=Waiting on Mike");
await shot(nick, "player-picked-waiting");
await mike.waitForSelector("text=Nick won");
await mike.click("button:has-text('Nick won')");
await mike.click("button:has-text('Tap again: Nick won')");
await nick.waitForSelector("text=You won $6", { timeout: 15000 });
await shot(nick, "player-won");
await mike.waitForSelector("text=Nick won that one", { timeout: 15000 });
await shot(mike, "player-lost");

// ---- me page
await nick.goto(`${BASE}/me`);
await nick.waitForSelector("text=Verify your number");
await shot(nick, "player-account");

// ---- bartender
const bp = await bart.newPage();
await bp.goto(`${BASE}/staff`);
await bp.waitForSelector("text=I'm on shift");
await shot(bp, "bartender");

// ---- owner
const ownerCtx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
await api(ownerCtx, "POST", "/api/staff/login", { phone: `610777${stamp.slice(0, 4)}`, pin: "2468" });
const op = await ownerCtx.newPage();
await op.goto(`${BASE}/owner`);
await op.waitForSelector("text=Next payout");
await shot(op, "owner");

// ---- TV
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
await tv.goto(`${BASE}/tv/${v.slug}`);
await tv.waitForSelector("text=Top tippers this week");
await shot(tv, "tv");

// ---- admin
const ap = await admin.newPage();
await ap.setViewportSize({ width: 1180, height: 900 });
await ap.goto(`${BASE}/admin`);
await ap.waitForSelector("text=Bars");
await shot(ap, "admin");
await ap.goto(`${BASE}/admin/print/${v.id}`);
await ap.waitForSelector("text=Scan to play");
await shot(ap, "print-sheet");

await browser.close();
console.log("done", OUT);
