// Playwright smoke test: owner app + HQ Reviews tabs render at 390px with mocked Supabase RPCs, no console errors.
// Run from repo root:  node reviews/test/ui.spec.mjs   (needs `npx playwright install chromium` once)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = process.cwd();
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const srv = createServer(async (req, res) => {
  let p = req.url.split("?")[0]; if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end("nope"); }
}).listen(0);
const port = srv.address().port;

const BIZ = "11111111-1111-1111-1111-111111111111";
const reqs = [
  { id: "a1", business_id: BIZ, business: "Test Plumbing", customer_name: "Dave Smith", phone: "+16105550101", source: "rx_job", status: "queued", touches: 0, next_at: new Date(Date.now() + 36e5).toISOString(), created_at: new Date().toISOString() },
  { id: "a2", business_id: BIZ, business: "Test Plumbing", customer_name: "Jane Doe", phone: "+16105550102", source: "manual", status: "sent", touches: 1, sent_at: new Date(Date.now() - 864e5).toISOString(), next_at: new Date(Date.now() + 2 * 864e5).toISOString(), created_at: new Date(Date.now() - 864e5).toISOString() },
  { id: "a3", business_id: BIZ, business: "Test Plumbing", customer_name: "Al", phone: "+16105550103", source: "import", status: "clicked", touches: 1, sent_at: new Date().toISOString(), clicked_at: new Date().toISOString(), created_at: new Date().toISOString() },
  { id: "a4", business_id: BIZ, business: "Test Plumbing", customer_name: null, phone: "+16105550104", source: "webhook", status: "stopped", touches: 0, note: "Texted STOP", created_at: new Date().toISOString() },
];
const counts = { queued: 1, sent: 2, clicked: 1, reviewed: 0, stopped: 1, month_sent: 2, month_clicked: 1, week_sent: 2, week_clicked: 1 };
const summary = { on: true, review_url: null, google_place_id: "ChIJabc", link: "https://search.google.com/local/writereview?placeid=ChIJabc", requests: reqs, counts, weekly: [{ week: "2026-10-12", sent: 2, clicked: 1, reviewed: 0 }], google: { rating: 4.8, count: 31, day: "2026-10-13", month_gain: 3 } };
const biz = { id: BIZ, slug: "t", name: "Test Plumbing", trade: "plumbing", owner_name: "Nicole", owner_phone: "+16105550100", agent_name: "Dana", agent_number: "+16109986138", timezone: "America/New_York", service_zips: [], hours: { mon: ["07:00", "17:00"] }, windows: [["07:00", "09:00"]], jobs_per_window: 2, emergency_policy: "after_hours_dispatch", free_estimates: true, active: true, created_at: new Date().toISOString() };

const RPC = {
  rx_owner_me: { business: biz, services: [], jobs: [], calls: [], messages: [], stats: { calls: 0, jobs: 0, booked_value: 0, after_hours_jobs: 0, unhandled_msgs: 0 } },
  rx_owner_reviews: summary,
  rx_owner_review_request: { ok: true, id: "x", status: "queued" },
  rx_owner_review_import: { added: 2, dup: 0, bad: 1 },
  rx_owner_review_settings: null, rx_owner_review_action: null,
  is_hq_admin: true,
  hq_pipeline: [], hq_rx: { businesses: [biz], calls: [], jobs: [], stats: {} }, hq_prospects: [], hq_agent_posts: [], hq_review_asks: { asks: [], no_url: [], pending: 0 },
  hq_agent_brains: [], hq_agent_runs: [], hq_post_results: {}, hq_seo: { keywords: [], links: [] }, hq_meta_config: null, hq_projects: [], hq_playbook: [], hq_config_keys: [],
  hq_reviews: { clients: [{ id: BIZ, name: "Test Plumbing", slug: "t", active: true, on: true, review_url: null, google_place_id: "ChIJabc", link: summary.link, hook_token: "abc123", queued: 1, sent: 2, clicked: 1, month_sent: 2, month_clicked: 1, stopped: 1, google: { rating: 4.8, count: 31 }, last_sent: new Date().toISOString() },
    { id: "22222222-2222-2222-2222-222222222222", name: "Off Shop", slug: "o", active: true, on: false, review_url: null, google_place_id: null, link: null, hook_token: "def456", queued: 0, sent: 0, clicked: 0, month_sent: 0, month_clicked: 0, stopped: 0, google: null, last_sent: null }],
    requests: reqs, month: { sent: 2, clicked: 1, queued: 1, on: 1 } },
  hq_review_settings: null, hq_review_request: { ok: true, id: "y", status: "queued" }, hq_review_action: null,
};

const browser = await chromium.launch();
const errors = [];
async function page(path, setup) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const pg = await ctx.newPage();
  pg.on("console", (m) => { if (m.type() === "error") errors.push(`${path} console: ${m.text()}`); });
  pg.on("pageerror", (e) => errors.push(`${path} pageerror: ${e.message}`));
  await pg.route(/supabase\.co\/auth\/v1\/.*/, (r) => {
    const u = r.request().url();
    if (u.includes("/token")) return r.fulfill({ json: { access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "bearer", user: { id: "u", email: "o@x.com" } } });
    if (u.includes("/user")) return r.fulfill({ json: { id: "u", email: "o@x.com" } });
    return r.fulfill({ json: {} });
  });
  await pg.route(/supabase\.co\/rest\/v1\/rpc\/(\w+)/, (r) => { const fn = r.request().url().match(/rpc\/(\w+)/)[1]; if (!(fn in RPC)) errors.push(`${path} unmocked rpc ${fn}`); return r.fulfill({ json: RPC[fn] ?? null }); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com.*/, (r) => r.fulfill({ status: 200, body: "" }));
  await pg.goto(`http://localhost:${port}${path}`);
  await pg.fill("#em", "o@x.com"); await pg.fill("#pw", "pw"); await pg.click("#go");
  await pg.waitForSelector("#app:not(.hidden)", { timeout: 8000 });
  await setup(pg);
  const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) errors.push(`${path} horizontal overflow ${over}px`);
  await pg.screenshot({ path: `reviews/test/shot-${path.replace(/\W+/g, "_")}.png`, fullPage: true });
  await ctx.close();
}

await page("/receptionist/app/", async (pg) => {
  await pg.click('.tabs button[data-tab="reviews"]');
  await pg.waitForSelector("#rvAdd");
  const txt = await pg.textContent("#reviews");
  for (const s of ["Asked this month", "Dave Smith", "Jane Doe", "Stopped", "Tapped"]) if (!txt.includes(s)) errors.push(`owner app missing "${s}"`);
  await pg.fill("#rvName", "New Guy"); await pg.fill("#rvPhone", "6105550199"); await pg.click("#rvAdd");
  await pg.waitForTimeout(800); const m = await pg.textContent("#rvAddMsg").catch(() => "(gone)"); if (!/Added/.test(m)) errors.push(`owner app add msg: ${m}`);
  await pg.click("#rvFilters button[data-f=stopped]");
  if (!(await pg.textContent("#rvList")).includes("Texted STOP")) errors.push("owner app stopped filter");
});
await page("/hq/", async (pg) => {
  await pg.click('.tabs button[data-tab="reviews"]');
  await pg.waitForSelector("#rvClients .card");
  const txt = await pg.textContent("#t-reviews");
  for (const s of ["Shops on", "Test Plumbing", "Off Shop", "Turn on", "Turn off", "Hook URL", "Dave Smith"]) if (!txt.includes(s)) errors.push(`hq missing "${s}"`);
  await pg.screenshot({ path: "reviews/test/shot-hq-reviews.png", fullPage: true });
  await pg.click('.tabs button[data-tab="clients"]');
  if (!(await pg.textContent("#bizs")).includes("asked")) errors.push("hq clients card missing reviews line");
});

await browser.close(); srv.close();
if (errors.length) { console.error("FAIL\n" + errors.join("\n")); process.exit(1); }
console.log("OK: owner app + HQ Reviews tabs render at 390px, no console errors, no overflow.");
