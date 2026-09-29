import { currentPlayer, handler } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, RULES } from "@/lib/env";
import { stripeReady } from "@/lib/stripe";
import { json, prettyPhone } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const c = await currentPlayer();
  if (!c) return json({ player: null });
  const { player, verified } = c;
  const q = await db();
  const ledger = await q<{ id: string; kind: string; amount_cents: number; note: string | null; created_at: string }[]>`
    select id, kind, amount_cents, note, created_at from chalk_ledger where player_id = ${player.id} order by created_at desc limit 30`;
  const games = await q<{ id: string; status: string; stake_cents: number; winner_cents: number; won: boolean; opponent: string | null; venue: string; station: string; ended_at: string | null; prize_mode: string; prize_redeemed_at: string | null }[]>`
    select m.id, m.status, m.stake_cents, m.winner_cents, (m.winner_id = ${player.id}) as won,
           op.first_name as opponent, v.name as venue, s.name as station, m.ended_at, m.prize_mode, m.prize_redeemed_at
      from chalk_matches m
      join chalk_venues v on v.id = m.venue_id
      join chalk_stations s on s.id = m.station_id
      left join chalk_players op on op.id = case when m.player_a_id = ${player.id} then m.player_b_id else m.player_a_id end
     where (m.player_a_id = ${player.id} or m.player_b_id = ${player.id}) and m.status in ('completed','voided','live','disputed','open')
     order by m.opened_at desc limit 20`;
  const prizes = games.filter((g) => g.status === "completed" && g.won && g.prize_mode === "gift_card" && !g.prize_redeemed_at);
  return json({
    player: {
      id: player.id,
      first_name: player.first_name,
      phone: prettyPhone(player.phone),
      balance_cents: player.balance_cents,
      verified,
      locked: player.locked,
      stripe_onboarded: player.stripe_onboarded,
    },
    ledger,
    games,
    prizes,
    cashout: {
      enabled: stripeReady() && !env.demoPayments,
      min_cents: RULES.MIN_CASHOUT_CENTS,
      otp: env.otpEnabled,
    },
  });
});
