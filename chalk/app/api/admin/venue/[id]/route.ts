import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { venueOwed } from "@/lib/settle";
import type { Venue } from "@/lib/types";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const q = await db();
  const [venue] = await q<Venue[]>`select * from chalk_venues where id = ${id}`;
  if (!venue) return bad("No such venue", 404);
  const stations = await q`select id, code, name, game, active from chalk_stations where venue_id = ${id} order by name`;
  const staff = await q`select id, name, phone, role, active, on_shift, stripe_onboarded, (pin_hash is not null) as has_pin from chalk_staff where venue_id = ${id} order by active desc, role, name`;
  const matches = await q`
    select m.id, m.status, m.stake_cents, m.winner_cents, m.bar_cents, m.platform_cents, m.void_reason, m.opened_at, m.ended_at, s.name as station,
           pa.first_name as a_name, pb.first_name as b_name, pw.first_name as winner, m.a_pick, m.b_pick, m.player_a_id, m.player_b_id
      from chalk_matches m join chalk_stations s on s.id = m.station_id
      left join chalk_players pa on pa.id = m.player_a_id left join chalk_players pb on pb.id = m.player_b_id left join chalk_players pw on pw.id = m.winner_id
     where m.venue_id = ${id} order by m.opened_at desc limit 40`;
  const settlements = await q`select * from chalk_settlements where venue_id = ${id} order by created_at desc limit 20`;
  const players = await q`
    select p.id, p.first_name, p.phone, p.balance_cents, p.locked, p.verified_at is not null as verified,
           count(m.id)::int as games
      from chalk_players p join chalk_matches m on (m.player_a_id = p.id or m.player_b_id = p.id) and m.venue_id = ${id}
     group by p.id order by count(m.id) desc limit 30`;
  const owed = await venueOwed(id);
  return json({ venue, stations, staff, matches, settlements, players, owed, app_url: env.appUrl });
});

export const POST = handler(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const b = await body<{ prize_mode?: string; status?: string; free_until?: string | null; stakes?: number[]; name?: string; city?: string }>(req);
  const q = await db();
  if (b.prize_mode) await q`update chalk_venues set prize_mode = ${b.prize_mode === "gift_card" ? "gift_card" : "cash"} where id = ${id}`;
  if (b.status && ["active", "paused", "closed"].includes(b.status)) await q`update chalk_venues set status = ${b.status} where id = ${id}`;
  if (b.free_until !== undefined) await q`update chalk_venues set free_until = ${b.free_until || null} where id = ${id}`;
  if (b.stakes && Array.isArray(b.stakes)) {
    const stakes = b.stakes.map((s) => Math.round(Number(s))).filter((s) => s >= 100 && s <= 10000);
    if (stakes.length) await q`update chalk_venues set stake_options_cents = ${stakes} where id = ${id}`;
  }
  if (b.name) await q`update chalk_venues set name = ${b.name.slice(0, 60)} where id = ${id}`;
  if (b.city !== undefined) await q`update chalk_venues set city = ${b.city || null} where id = ${id}`;
  return json({ ok: true });
});
