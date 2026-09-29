// End-to-end walk through every money path, against a running server (default http://localhost:3000).
// Uses demo payments (no Stripe) and the dev OTP code. Exits non-zero on the first failed check.
const BASE = process.env.BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_PASSWORD || "letmein";
const OTP = process.env.OTP_DEV_CODE || "000000";

class Actor {
  constructor(name) { this.name = name; this.cookies = {}; }
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method, headers: { "Content-Type": "application/json", Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined, redirect: "manual",
    });
    for (const sc of res.headers.getSetCookie?.() || []) {
      const [kv] = sc.split(";"); const [k, v] = kv.split("=");
      if (v === "" || /Max-Age=0/i.test(sc)) delete this.cookies[k]; else this.cookies[k] = v;
    }
    const j = await res.json().catch(() => ({}));
    return { status: res.status, ...j, _json: j };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b || {}); }
}

let n = 0;
function check(cond, msg, extra) {
  n++;
  if (!cond) { console.error(`✗ ${n}. ${msg}`, extra ? JSON.stringify(extra).slice(0, 600) : ""); process.exit(1); }
  console.log(`✓ ${n}. ${msg}`);
}
const money = (c) => `$${(c / 100).toFixed(2)}`;
const stamp = Date.now().toString().slice(-6);

const admin = new Actor("admin");
const nick = new Actor("nick");
const mike = new Actor("mike");
const owner = new Actor("owner");
const bart = new Actor("bartender");

// ---- admin creates a bar
let r = await admin.post("/api/admin/login", { password: ADMIN });
check(r.ok, "admin logs in", r);
r = await admin.post("/api/admin/venue", { name: `Test Tavern ${stamp}`, city: "Pottstown", owner_name: "Dee", owner_phone: `610555${stamp.slice(0, 4)}`, tables: 2, boards: 1, prize_mode: "cash", free_days: 0 });
check(r.ok && r.id, "admin creates a bar with 2 tables and a board", r);
const venueId = r.id;
r = await admin.get(`/api/admin/venue/${venueId}`);
check(r.stations?.length === 3 && r.staff?.length === 1, "bar has 3 stations and an owner login", r);
const t1 = r.stations.find((s) => s.name === "Table 1").code;
const ownerPhone = r.staff[0].phone;
r = await admin.post("/api/admin/staff", { venue_id: venueId, name: "Sam", phone: `484555${stamp.slice(0, 4)}`, role: "bartender" });
check(r.ok, "admin adds bartender Sam", r);
const samPhone = `484555${stamp.slice(0, 4)}`;

// ---- bartender logs in (first PIN), starts shift
r = await bart.post("/api/staff/login", { phone: samPhone, pin: "1234" });
check(r.ok && r.name === "Sam", "Sam logs in and sets a PIN", r);
r = await bart.post("/api/staff/login", { phone: samPhone, pin: "9999" });
check(r.status === 401, "wrong PIN rejected", r);
r = await bart.post("/api/staff/login", { phone: samPhone, pin: "1234" });
check(r.ok, "right PIN works", r);
r = await bart.post("/api/staff/shift", { on: true });
check(r.ok && r.on_shift, "Sam starts shift", r);

// ---- station view before anyone identifies
r = await nick.get(`/api/station/${t1}`);
check(r.station?.code === t1 && r.me === null && r.demo === true, "table page loads, asks who you are, demo payments on", r);
check(r.split["500"].winner === 600 && r.split["500"].bar === 200 && r.split["500"].platform === 200, "$5 game splits 6/2/2", r.split);

// ---- Nick identifies and opens a $5 game with a $2 tip
r = await nick.post("/api/auth/identify", { first_name: "nick", phone: `215555${stamp.slice(0, 4)}` });
check(r.ok !== false && r.first_name === "Nick", "Nick identifies (name capitalized)", r);
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 200, tip_staff_id: (await nick.get(`/api/station/${t1}`)).staff[0].id, method: "demo" });
check(r.paid === true && r.match_id, "Nick pays $5 + $2 tip (demo), game is open", r);
const matchId = r.match_id;
r = await nick.get(`/api/station/${t1}`);
check(r.match?.status === "open" && r.match.a?.name === "Nick", "table shows Nick waiting", r.match);

// ---- Mike sees it and joins
r = await mike.get(`/api/station/${t1}`);
check(r.match?.status === "open" && r.me === null, "Mike sees Nick's open game", r.match);
r = await mike.post("/api/auth/identify", { first_name: "Mike", phone: `267555${stamp.slice(0, 4)}` });
check(r.first_name === "Mike", "Mike identifies", r);
r = await mike.post("/api/match/enter", { code: t1, join_match_id: matchId, tip_cents: 0, method: "demo" });
check(r.paid === true && r.match_id === matchId, "Mike joins (demo pay)", r);
r = await mike.get(`/api/station/${t1}`);
check(r.match?.status === "live" && r.match.b?.name === "Mike", "game is live: Nick vs Mike", r.match);
const nickId = r.match.a.id, mikeId = r.match.b.id;

// ---- both say Nick won
r = await nick.post("/api/match/pick", { match_id: matchId, winner_id: nickId });
check(r.outcome === "waiting", "Nick says Nick won; waiting on Mike", r);
r = await mike.post("/api/match/pick", { match_id: matchId, winner_id: nickId });
check(r.outcome === "completed" && r.winner_id === nickId, "Mike agrees; match completed", r);
r = await nick.get("/api/me");
check(r.player.balance_cents === 600, `Nick's balance is ${money(r.player.balance_cents)} (expected $6.00)`, r.player);
r = await nick.get(`/api/station/${t1}`);
check(r.match === null && r.last?.winner === "Nick" && r.last.loser === "Mike", "table shows last result, table is free", r.last);
r = await bart.get("/api/staff/state");
check(r.tips.today === 190 && r.recentTips[0].from_name === "Nick", `Sam got ${money(r.tips.today)} of the $2 tip (5% platform fee)`, r.tips);
r = await mike.get(`/api/tv/${(await admin.get(`/api/admin/venue/${venueId}`)).venue.slug}`);
check(r.tippers[0]?.first_name === "Nick" && r.players[0]?.first_name === "Nick" && r.recent[0]?.winner === "Nick", "TV board shows Nick on top", { tippers: r.tippers, players: r.players });

// ---- Nick verifies, plays from balance; they disagree; Sam settles for Mike
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "balance" });
check(r.status === 400 && /verify/i.test(r.error), "balance blocked until verified", r);
r = await nick.post("/api/auth/otp/send");
check(r.ok && r.dev, "OTP send (dev mode)", r);
r = await nick.post("/api/auth/otp/verify", { code: "123456" });
check(r.status === 400, "wrong OTP rejected", r);
r = await nick.post("/api/auth/otp/verify", { code: OTP });
check(r.ok, "OTP verified", r);
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "balance" });
check(r.paid && r.match_id, "Nick opens a game from balance", r);
const m2 = r.match_id;
r = await nick.get("/api/me");
check(r.player.balance_cents === 100, `balance now ${money(r.player.balance_cents)} (expected $1.00)`, r.player);
r = await mike.post("/api/match/enter", { code: t1, join_match_id: m2, method: "demo" });
check(r.paid, "Mike joins game 2", r);
r = await nick.post("/api/match/pick", { match_id: m2, winner_id: nickId });
r = await mike.post("/api/match/pick", { match_id: m2, winner_id: mikeId });
check(r.outcome === "disputed", "they disagree -> disputed", r);
r = await bart.get("/api/staff/state");
check(r.matches[0]?.status === "disputed" && r.matches[0].id === m2, "Sam sees the dispute first", r.matches);
r = await bart.post("/api/staff/settle", { match_id: m2, winner_id: mikeId });
check(r.ok && r.status === "completed", "Sam settles: Mike won", r);
r = await mike.get("/api/me");
check(r.player.balance_cents === 600, `Mike's balance ${money(r.player.balance_cents)} (expected $6.00)`, r.player);

// ---- cancel while waiting refunds a balance entry
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "demo" });
const m3 = r.match_id;
check(r.paid, "Nick opens game 3 (demo)", r);
r = await mike.post("/api/match/cancel", { match_id: m3 });
check(r.status === 400, "Mike can't cancel Nick's game", r);
r = await nick.post("/api/match/cancel", { match_id: m3 });
check(r.ok, "Nick cancels his own game", r);
r = await nick.get(`/api/station/${t1}`);
check(r.match === null, "table free again", r.match);

// ---- two people both tap Play at once -> merged into one game
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "demo" });
const m4 = r.match_id;
r = await mike.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "demo" });
check(r.paid && r.match_id === m4, "Mike also tapped Play and paid; server merged him into Nick's game", r);
r = await nick.get(`/api/station/${t1}`);
check(r.match?.status === "live" && r.match.id === m4 && r.match.b?.name === "Mike", "…and got merged into Nick's game as player B", r.match);
r = await bart.post("/api/staff/settle", { match_id: m4, winner_id: null });
check(r.ok && r.status === "voided", "Sam voids it, both refunded (demo)", r);

// ---- events
r = await owner.post("/api/staff/login", { phone: ownerPhone, pin: "2468" });
check(r.ok && r.role === "owner", "owner logs in", r);
const when = new Date(Date.now() + 3600 * 1000).toISOString();
r = await owner.post("/api/owner/event", { name: "Thursday 8-ball", game: "pool", format: "single_elim", entry_cents: 1500, capacity: 8, starts_at: when, prize_text: "$100 tab" });
check(r.ok && r.id, "owner creates a $15 event", r);
const eventId = r.id;
r = await nick.post(`/api/events/${eventId}/enter`, {});
check(r.paid && r.entry_id, "Nick enters (demo: $15 + $1.50 fee)", r);
r = await nick.post(`/api/events/${eventId}/enter`, {});
check(r.status === 400 && /already/i.test(r.error), "can't enter twice", r);
r = await mike.post(`/api/events/${eventId}/enter`, {});
check(r.paid, "Mike enters", r);
r = await bart.post(`/api/events/${eventId}/checkin`, { walkup_name: "Dana" });
check(r.ok, "Sam adds walk-up Dana", r);
r = await bart.post(`/api/events/${eventId}/start`);
check(r.ok, "bracket starts with 3 players", r);
r = await nick.get(`/api/events/${eventId}`);
check(r.event.status === "live" && r.matches.length === 3 && r.matches.filter((m) => m.status === "bye").length === 1, "3-player single elim: 2 round-1 slots, one bye, a final", r.matches);
const ready = r.matches.find((m) => m.status === "ready");
r = await bart.post(`/api/events/${eventId}/result`, { bracket_match_id: ready.id, winner_entry_id: ready.a.id });
check(r.ok, "Sam records round 1 result", r);
r = await nick.get(`/api/events/${eventId}`);
const final = r.matches.find((m) => m.round === 2);
check(final.status === "ready" && final.a && final.b, "final is ready with both players", final);
r = await bart.post(`/api/events/${eventId}/result`, { bracket_match_id: final.id, winner_entry_id: final.b.id });
r = await nick.get(`/api/events/${eventId}`);
check(r.event.status === "done" && r.champion === final.b.name, `event done, champion ${r.champion}`, r.event);

// ---- owner dashboard + settlement
r = await owner.get("/api/owner/state");
check(r.owed.games === 2 && r.owed.games_cents === 400 && r.owed.entries === 2 && r.owed.events_cents === 2700, `owed to bar: 2 games ($4) + 2 entries ($27) = ${money(r.owed.total_cents)}`, r.owed);
r = await admin.post("/api/admin/settle", { venue_id: venueId });
check(r.created && r.pending === 3100, "settlement rolled up $31, pending (no Stripe yet)", r);
r = await owner.get("/api/owner/state");
check(r.owed.games === 0 && r.owed.pending_cents === 3100 && r.settlements[0].status === "pending", "owner sees $31 pending payout", { owed: r.owed, s: r.settlements[0] });
r = await admin.get("/api/admin/state");
check(r.totals.platform_all >= 400, `platform earned ${money(r.totals.platform_all)} all time`, r.totals);

// ---- balance guard
r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "balance" });
check(r.status === 400 && /insufficient/i.test(r.error), "can't play $5 from a $1 balance", r);

// ---- sweep: stale open game gets voided + refunded; half-picked game goes to the bartender
import { execSync } from "node:child_process";
const psql = (sql) => execSync(`/usr/lib/postgresql/16/bin/psql -h /tmp/pg -p 5433 -U postgres -d postgres -Atc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
if (process.env.LOCAL_PG !== "0") {
  r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "demo" });
  const m5 = r.match_id;
  psql(`update chalk_matches set opened_at = now() - interval '20 minutes' where id = '${m5}'`);
  r = await nick.get(`/api/station/${t1}`);
  check(r.match === null, "stale open game swept away", r.match);
  check(psql(`select status || ':' || void_reason from chalk_matches where id = '${m5}'`) === "voided:no opponent showed up", "…voided with reason");
  check(psql(`select status from chalk_payments where match_id = '${m5}'`) === "refunded", "…and the entry refunded");

  r = await nick.post("/api/match/enter", { code: t1, stake_cents: 500, tip_cents: 0, method: "demo" });
  const m6 = r.match_id;
  await mike.post("/api/match/enter", { code: t1, join_match_id: m6, method: "demo" });
  await nick.post("/api/match/pick", { match_id: m6, winner_id: nickId });
  psql(`update chalk_matches set first_pick_at = now() - interval '16 minutes' where id = '${m6}'`);
  r = await nick.get(`/api/station/${t1}`);
  check(r.match?.status === "disputed", "one-sided pick after 15 min -> bartender", r.match);
  r = await bart.post("/api/staff/settle", { match_id: m6, winner_id: nickId });
  check(r.ok, "Sam settles it", r);
}

console.log(`\nall ${n} checks passed`);
