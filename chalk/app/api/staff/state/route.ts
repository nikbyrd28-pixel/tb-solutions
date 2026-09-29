import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sweep } from "@/lib/matches";
import { stripeReady } from "@/lib/stripe";
import { json } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const { staff, venue } = await requireStaff();
  await sweep({ venueId: venue.id }).catch((e) => console.error("sweep", e));
  const q = await db();

  const [tips] = await q<{ today: number; week: number; all: number; unpaid: number }[]>`
    select coalesce(sum(staff_cents) filter (where created_at > date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York'), 0)::int as today,
           coalesce(sum(staff_cents) filter (where created_at > now() - interval '7 days'), 0)::int as week,
           coalesce(sum(staff_cents), 0)::int as all,
           coalesce(sum(staff_cents) filter (where status = 'pending'), 0)::int
             + (select coalesce(sum(amount_cents),0)::int from chalk_settlements where staff_id = ${staff.id} and payee_type = 'staff' and status = 'pending') as unpaid
      from chalk_tips where staff_id = ${staff.id} and status <> 'refunded'`;

  const recentTips = await q<{ amount_cents: number; staff_cents: number; from_name: string; created_at: string }[]>`
    select t.amount_cents, t.staff_cents, p.first_name as from_name, t.created_at
      from chalk_tips t left join chalk_players p on p.id = t.player_id
     where t.staff_id = ${staff.id} order by t.created_at desc limit 15`;

  const matches = await q<{
    id: string; status: string; stake_cents: number; winner_cents: number; station: string;
    a_id: string | null; a_name: string | null; b_id: string | null; b_name: string | null; a_pick: string | null; b_pick: string | null;
    opened_at: string; live_at: string | null; first_pick_at: string | null;
  }[]>`
    select m.id, m.status, m.stake_cents, m.winner_cents, s.name as station,
           m.player_a_id as a_id, pa.first_name as a_name, m.player_b_id as b_id, pb.first_name as b_name,
           m.a_pick, m.b_pick, m.opened_at, m.live_at, m.first_pick_at
      from chalk_matches m
      join chalk_stations s on s.id = m.station_id
      left join chalk_players pa on pa.id = m.player_a_id
      left join chalk_players pb on pb.id = m.player_b_id
     where m.venue_id = ${venue.id} and ((m.status = 'open' and m.a_paid) or m.status in ('live','disputed'))
     order by case m.status when 'disputed' then 0 when 'live' then 1 else 2 end, m.opened_at asc`;

  const prizes = await q<{ id: string; winner: string; winner_cents: number; station: string; ended_at: string }[]>`
    select m.id, p.first_name as winner, m.winner_cents, s.name as station, m.ended_at
      from chalk_matches m join chalk_players p on p.id = m.winner_id join chalk_stations s on s.id = m.station_id
     where m.venue_id = ${venue.id} and m.status = 'completed' and m.prize_mode = 'gift_card' and m.prize_redeemed_at is null
     order by m.ended_at desc limit 20`;

  const events = await q<{ id: string; name: string; starts_at: string; status: string; entries: number; capacity: number; format: string; entry_cents: number }[]>`
    select e.id, e.name, e.starts_at, e.status, e.capacity, e.format, e.entry_cents,
           (select count(*)::int from chalk_event_entries ee where ee.event_id = e.id and ee.status in ('paid','checked_in')) as entries
      from chalk_events e where e.venue_id = ${venue.id} and e.status in ('open','live') and e.starts_at > now() - interval '12 hours'
     order by e.starts_at asc limit 5`;

  const onShift = await q<{ id: string; name: string }[]>`select id, name from chalk_staff where venue_id = ${venue.id} and active and on_shift order by shift_started_at`;

  return json({
    me: { id: staff.id, name: staff.name, role: staff.role, on_shift: staff.on_shift, stripe_onboarded: staff.stripe_onboarded },
    venue: { id: venue.id, name: venue.name, slug: venue.slug, prize_mode: venue.prize_mode },
    tips,
    recentTips,
    matches,
    prizes,
    events,
    onShift,
    payouts: { enabled: stripeReady() && !env.demoPayments },
    now: new Date().toISOString(),
  });
});
