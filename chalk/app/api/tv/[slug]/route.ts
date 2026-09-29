import { handler } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventView } from "@/lib/events";
import { venueBySlug } from "@/lib/matches";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Public. Everything the bar's TV shows.
export const GET = handler(async (_req, { params }) => {
  const { slug } = await params;
  const venue = await venueBySlug(slug);
  if (!venue) return bad("No such bar", 404);
  const q = await db();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const tippers = await q<{ first_name: string; total_cents: number; tips: number }[]>`select * from chalk_top_tippers(${venue.id}, ${weekAgo}, 10)`;
  const players = await q<{ first_name: string; wins: number; played: number; won_cents: number }[]>`select * from chalk_top_players(${venue.id}, ${monthAgo}, 10)`;
  const live = await q<{ station: string; a: string | null; b: string | null; status: string; pot_cents: number; winner_cents: number }[]>`
    select s.name as station, pa.first_name as a, pb.first_name as b, m.status, m.pot_cents, m.winner_cents
      from chalk_matches m join chalk_stations s on s.id = m.station_id
      left join chalk_players pa on pa.id = m.player_a_id left join chalk_players pb on pb.id = m.player_b_id
     where m.venue_id = ${venue.id} and ((m.status = 'open' and m.a_paid) or m.status in ('live','disputed'))
     order by s.name`;
  const recent = await q<{ station: string; winner: string; loser: string; winner_cents: number; ended_at: string }[]>`
    select s.name as station, pw.first_name as winner, pl.first_name as loser, m.winner_cents, m.ended_at
      from chalk_matches m join chalk_stations s on s.id = m.station_id
      join chalk_players pw on pw.id = m.winner_id
      join chalk_players pl on pl.id = case when m.winner_id = m.player_a_id then m.player_b_id else m.player_a_id end
     where m.venue_id = ${venue.id} and m.status = 'completed' order by m.ended_at desc limit 8`;
  const [ev] = await q<{ id: string }[]>`
    select id from chalk_events where venue_id = ${venue.id} and status in ('open','live')
       and starts_at between now() - interval '8 hours' and now() + interval '36 hours'
     order by case status when 'live' then 0 else 1 end, starts_at asc limit 1`;
  const event = ev ? await eventView(ev.id) : null;
  return json({
    venue: { name: venue.name, slug: venue.slug, stakes: venue.stake_options_cents, prize_mode: venue.prize_mode },
    tippers: tippers.map((t) => ({ ...t, total_cents: Number(t.total_cents) })),
    players: players.map((p) => ({ ...p, won_cents: Number(p.won_cents) })),
    live,
    recent,
    event,
    now: new Date().toISOString(),
  });
});
