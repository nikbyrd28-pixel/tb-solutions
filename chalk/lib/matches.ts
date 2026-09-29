import { db, tx, type Q, type Tx } from "./db";
import { RULES, env } from "./env";
import { refundIntent, stripeReady } from "./stripe";
import type { Match, Payment, Player, Staff, Station, Venue } from "./types";

// ------------------------------------------------------------------ money split

export function computeSplit(stakeCents: number, venue: Venue) {
  const pot = stakeCents * 2;
  const winner = Math.round((pot * venue.winner_bps) / 10000);
  let bar = Math.round((pot * venue.bar_bps) / 10000);
  let platform = pot - winner - bar;
  if (venue.free_until && new Date(venue.free_until) >= new Date(new Date().toDateString())) {
    bar += platform;
    platform = 0;
  }
  return { pot, winner, bar, platform };
}

export function tipSplit(tipCents: number, venue: Venue) {
  const fee = Math.floor((tipCents * venue.tip_platform_fee_bps) / 10000);
  return { fee, staff: tipCents - fee };
}

// ------------------------------------------------------------------ reads

export async function venueBySlug(slug: string) {
  const q = await db();
  const [v] = await q<Venue[]>`select * from chalk_venues where slug = ${slug}`;
  return v || null;
}

export async function venueById(id: string, q?: Q) {
  const c = q || (await db());
  const [v] = await c<Venue[]>`select * from chalk_venues where id = ${id}`;
  return v || null;
}

export async function stationByCode(code: string) {
  const q = await db();
  const [s] = await q<(Station & { venue: Venue })[]>`
    select s.*, row_to_json(v.*) as venue
      from chalk_stations s join chalk_venues v on v.id = s.venue_id
     where s.code = ${code.toLowerCase()}`;
  return s || null;
}

export async function playerById(id: string, q?: Q) {
  const c = q || (await db());
  const [p] = await c<Player[]>`select * from chalk_players where id = ${id}`;
  return p || null;
}

export async function onShiftStaff(venueId: string) {
  const q = await db();
  return q<Pick<Staff, "id" | "name" | "role">[]>`
    select id, name, role from chalk_staff
     where venue_id = ${venueId} and active and on_shift
     order by shift_started_at asc nulls last`;
}

// The match a station is showing right now: a paid open match, or a live/disputed one.
export async function currentMatch(stationId: string, q?: Q) {
  const c = q || (await db());
  const [m] = await c<Match[]>`
    select * from chalk_matches
     where station_id = ${stationId}
       and ((status = 'open' and a_paid) or status in ('live','disputed'))
     order by opened_at asc
     limit 1`;
  return m || null;
}

export async function matchById(id: string, q?: Q) {
  const c = q || (await db());
  const [m] = await c<Match[]>`select * from chalk_matches where id = ${id}`;
  return m || null;
}

export async function paymentById(id: string, q?: Q) {
  const c = q || (await db());
  const [p] = await c<Payment[]>`select * from chalk_payments where id = ${id}`;
  return p || null;
}

// ------------------------------------------------------------------ open / join

export type EntryRequest = {
  station: Station;
  venue: Venue;
  player: Player;
  stakeCents: number;
  tipCents: number;
  tipStaffId: string | null;
  method: "card" | "balance" | "demo";
  joinMatchId?: string; // when joining an existing open match as player B
};

export async function createEntry(r: EntryRequest): Promise<{ payment: Payment; match: Match }> {
  if (!r.venue.stake_options_cents.includes(r.stakeCents) && !r.joinMatchId) throw new Error("Bad stake");
  if (r.player.locked) throw new Error("This account is locked. Ask the bartender.");
  if (r.tipCents < 0 || r.tipCents > 10000) throw new Error("Bad tip");
  if (r.tipCents > 0 && !r.tipStaffId) throw new Error("Pick who to tip");

  return tx(async (t) => {
    let match: Match;
    let slot: "a" | "b";
    if (r.joinMatchId) {
      const [m] = await t<Match[]>`select * from chalk_matches where id = ${r.joinMatchId} for update`;
      if (!m || m.status !== "open" || !m.a_paid) throw new Error("That game already filled up. Start a new one.");
      if (m.player_a_id === r.player.id) throw new Error("You're already in this game.");
      if (m.player_b_id && m.player_b_id !== r.player.id && m.b_paid) throw new Error("That game already filled up.");
      match = m;
      slot = "b";
    } else {
      const split = computeSplit(r.stakeCents, r.venue);
      const [m] = await t<Match[]>`
        insert into chalk_matches (venue_id, station_id, game, stake_cents, pot_cents, winner_cents, bar_cents, platform_cents, prize_mode, player_a_id)
        values (${r.venue.id}, ${r.station.id}, ${r.station.game}, ${r.stakeCents}, ${split.pot}, ${split.winner}, ${split.bar}, ${split.platform}, ${r.venue.prize_mode}, ${r.player.id})
        returning *`;
      match = m;
      slot = "a";
    }
    const amount = match.stake_cents + r.tipCents;
    const [payment] = await t<Payment[]>`
      insert into chalk_payments (player_id, venue_id, kind, match_id, match_slot, amount_cents, entry_cents, tip_cents, tip_staff_id, method)
      values (${r.player.id}, ${r.venue.id}, 'entry', ${match.id}, ${slot}, ${amount}, ${match.stake_cents}, ${r.tipCents}, ${r.tipStaffId}, ${r.method})
      returning *`;

    if (r.method === "balance") {
      if (!r.player.verified_at) throw new Error("Verify your number to use your balance.");
      await t`select chalk_adjust_balance(${r.player.id}, ${-amount}, 'entry', ${match.id}, ${payment.id}, ${"Entry" + (r.tipCents ? " + tip" : "")})`;
      await applyPaid(t, payment);
      const [p2] = await t<Payment[]>`select * from chalk_payments where id = ${payment.id}`;
      const m2 = await matchById(p2.match_id!, t);
      return { payment: p2, match: m2! };
    }
    if (r.method === "demo") {
      if (!env.demoPayments) throw new Error("Demo payments are off");
      await applyPaid(t, payment);
      const [p2] = await t<Payment[]>`select * from chalk_payments where id = ${payment.id}`;
      const m2 = await matchById(p2.match_id!, t);
      return { payment: p2, match: m2! };
    }
    return { payment, match };
  });
}

// ------------------------------------------------------------------ paid

// Idempotent. Call from the webhook, from the on-return check, and from balance/demo paths.
export async function markPaid(paymentId: string, stripeIntentId?: string) {
  return tx(async (t) => {
    const [p] = await t<Payment[]>`select * from chalk_payments where id = ${paymentId} for update`;
    if (!p) throw new Error("payment not found");
    if (p.status === "paid" || p.status === "refunded") return p;
    if (stripeIntentId && !p.stripe_payment_intent_id) {
      await t`update chalk_payments set stripe_payment_intent_id = ${stripeIntentId} where id = ${p.id}`;
    }
    await applyPaid(t, p);
    const [p2] = await t<Payment[]>`select * from chalk_payments where id = ${p.id}`;
    return p2;
  });
}

async function applyPaid(t: Tx, p: Payment) {
  await t`update chalk_payments set status = 'paid', paid_at = now() where id = ${p.id}`;

  if (p.kind === "entry" && p.match_id) {
    const [m] = await t<Match[]>`select * from chalk_matches where id = ${p.match_id} for update`;
    if (!m) throw new Error("match not found");

    if (p.match_slot === "a") {
      if (m.status === "open" && !m.a_paid) {
        // If someone else already opened a paid game on this table, merge into it as player B.
        const [other] = await t<Match[]>`
          select * from chalk_matches
           where station_id = ${m.station_id} and status = 'open' and a_paid and id <> ${m.id}
             and player_a_id <> ${p.player_id} and stake_cents = ${m.stake_cents}
           order by opened_at asc limit 1 for update`;
        if (other) {
          await t`update chalk_matches set status = 'voided', void_reason = 'merged', ended_at = now() where id = ${m.id}`;
          await t`update chalk_payments set match_id = ${other.id}, match_slot = 'b' where id = ${p.id}`;
          await t`update chalk_matches set player_b_id = ${p.player_id}, b_paid = true, status = 'live', live_at = now() where id = ${other.id}`;
          await recordTip(t, { ...p, match_id: other.id });
          return;
        }
        await t`update chalk_matches set a_paid = true where id = ${m.id}`;
      } else if (m.status !== "open") {
        // Paid too late (match expired/voided while they were on the card screen): refund the entry.
        await queueRefundIfNeeded(t, { ...p, status: "paid" }, "paid after expiry");
        await recordTip(t, p);
        return;
      }
    } else if (p.match_slot === "b") {
      if (m.status === "open" && m.a_paid && (!m.player_b_id || m.player_b_id === p.player_id) && !m.b_paid) {
        await t`update chalk_matches set player_b_id = ${p.player_id}, b_paid = true, status = 'live', live_at = now() where id = ${m.id}`;
      } else {
        // The seat was taken or the game is gone; refund their entry, keep the tip.
        await queueRefundIfNeeded(t, { ...p, status: "paid" }, "seat taken");
        await recordTip(t, p);
        return;
      }
    }
    await recordTip(t, p);
    return;
  }

  if (p.kind === "ticket" && p.event_entry_id) {
    await t`update chalk_event_entries set status = 'paid' where id = ${p.event_entry_id} and status = 'pending'`;
    await recordTip(t, p);
    return;
  }

  if (p.kind === "load" && p.player_id) {
    await t`select chalk_adjust_balance(${p.player_id}, ${p.amount_cents}, 'load', null, ${p.id}, 'Loaded balance')`;
    return;
  }

  if (p.kind === "tip") {
    await recordTip(t, p);
  }
}

async function recordTip(t: Tx, p: Payment) {
  if (!p.tip_cents || !p.tip_staff_id || !p.venue_id) return;
  const [exists] = await t`select 1 from chalk_tips where payment_id = ${p.id}`;
  if (exists) return;
  const venue = await venueById(p.venue_id, t);
  if (!venue) return;
  const { fee, staff } = tipSplit(p.tip_cents, venue);
  await t`
    insert into chalk_tips (venue_id, staff_id, player_id, match_id, payment_id, amount_cents, platform_fee_cents, staff_cents)
    values (${p.venue_id}, ${p.tip_staff_id}, ${p.player_id}, ${p.match_id}, ${p.id}, ${p.tip_cents}, ${fee}, ${staff})`;
}

// ------------------------------------------------------------------ result

export type PickResult = { match: Match; outcome: "waiting" | "completed" | "disputed" };

export async function pickWinner(matchId: string, playerId: string, winnerId: string): Promise<PickResult> {
  const result = await tx(async (t) => {
    const [m] = await t<Match[]>`select * from chalk_matches where id = ${matchId} for update`;
    if (!m) throw new Error("match not found");
    if (m.status !== "live" && m.status !== "disputed") throw new Error("This game is over.");
    if (playerId !== m.player_a_id && playerId !== m.player_b_id) throw new Error("You're not in this game.");
    if (winnerId !== m.player_a_id && winnerId !== m.player_b_id) throw new Error("Bad pick");

    const col = playerId === m.player_a_id ? "a_pick" : "b_pick";
    await t`update chalk_matches set ${t(col)} = ${winnerId}, first_pick_at = coalesce(first_pick_at, now()) where id = ${m.id}`;
    const [m2] = await t<Match[]>`select * from chalk_matches where id = ${m.id}`;

    if (m2.a_pick && m2.b_pick) {
      if (m2.a_pick === m2.b_pick) {
        await completeMatch(t, m2, m2.a_pick, null);
        return { outcome: "completed" as const, id: m2.id };
      }
      await t`update chalk_matches set status = 'disputed', disputed_at = coalesce(disputed_at, now()) where id = ${m2.id}`;
      return { outcome: "disputed" as const, id: m2.id };
    }
    return { outcome: "waiting" as const, id: m2.id };
  });
  const match = (await matchById(result.id))!;
  return { match, outcome: result.outcome };
}

async function completeMatch(t: Tx, m: Match, winnerId: string, staffId: string | null) {
  await t`
    update chalk_matches
       set status = 'completed', winner_id = ${winnerId}, ended_at = now(), settled_by_staff_id = ${staffId}
     where id = ${m.id} and status in ('live','disputed')`;
  if (m.prize_mode === "cash") {
    await t`select chalk_adjust_balance(${winnerId}, ${m.winner_cents}, 'win', ${m.id}, null, 'Won a game')`;
  }
  // gift_card mode: the match row itself is the prize until a bartender marks it redeemed.
}

// Bartender's call. winnerId null = void it and give everyone their money back.
export async function settleByStaff(matchId: string, staff: Staff, winnerId: string | null) {
  const refunds = await tx(async (t) => {
    const [m] = await t<Match[]>`select * from chalk_matches where id = ${matchId} for update`;
    if (!m) throw new Error("match not found");
    if (m.venue_id !== staff.venue_id) throw new Error("Not your bar");
    if (!["live", "disputed", "open"].includes(m.status)) throw new Error("Already settled");
    if (winnerId) {
      if (m.status === "open") throw new Error("Nobody to beat yet");
      if (winnerId !== m.player_a_id && winnerId !== m.player_b_id) throw new Error("Bad winner");
      await completeMatch(t, m, winnerId, staff.id);
      return [] as Payment[];
    }
    return voidInTx(t, m, `voided by ${staff.name}`);
  });
  await runRefunds(refunds);
  return matchById(matchId);
}

// A player backing out while still waiting for an opponent.
export async function cancelOpen(matchId: string, playerId: string) {
  const refunds = await tx(async (t) => {
    const [m] = await t<Match[]>`select * from chalk_matches where id = ${matchId} for update`;
    if (!m || m.status !== "open") throw new Error("Can't cancel now");
    if (m.player_a_id !== playerId) throw new Error("Not your game");
    return voidInTx(t, m, "cancelled by player");
  });
  await runRefunds(refunds);
}

// ------------------------------------------------------------------ void + refunds

async function voidInTx(t: Tx, m: Match, reason: string): Promise<Payment[]> {
  await t`update chalk_matches set status = 'voided', void_reason = ${reason}, ended_at = now() where id = ${m.id}`;
  const pays = await t<Payment[]>`select * from chalk_payments where match_id = ${m.id} and kind = 'entry' and status = 'paid' for update`;
  const cardRefunds: Payment[] = [];
  for (const p of pays) {
    const r = await queueRefundIfNeeded(t, p, reason);
    if (r) cardRefunds.push(r);
  }
  return cardRefunds;
}

// Refund the entry portion of a paid payment (tip stays with the bartender).
// Balance/demo refunds happen here. Card refunds are returned to run after commit.
async function queueRefundIfNeeded(t: Tx, p: Payment, reason: string): Promise<Payment | null> {
  if (p.status !== "paid" || p.refunded_cents > 0 || p.entry_cents <= 0) return null;
  if (p.method === "balance" && p.player_id) {
    await t`select chalk_adjust_balance(${p.player_id}, ${p.entry_cents}, 'refund', ${p.match_id}, ${p.id}, ${"Refund: " + reason})`;
    await t`update chalk_payments set status = 'refunded', refunded_cents = ${p.entry_cents} where id = ${p.id}`;
    return null;
  }
  if (p.method === "demo") {
    await t`update chalk_payments set status = 'refunded', refunded_cents = ${p.entry_cents} where id = ${p.id}`;
    return null;
  }
  // card: flag it, refund through Stripe after commit (or on the next sweep if that fails)
  await t`update chalk_payments set refund_due = true where id = ${p.id}`;
  return p;
}

export async function runRefunds(pays: Payment[]) {
  if (!pays.length) return;
  const q = await db();
  for (const p of pays) {
    if (!p.stripe_payment_intent_id || !stripeReady()) continue;
    try {
      const r = await refundIntent(p.stripe_payment_intent_id, p.entry_cents);
      await q`update chalk_payments set status = 'refunded', refunded_cents = ${p.entry_cents}, stripe_refund_id = ${r.id}, refund_due = false where id = ${p.id}`;
    } catch (e) {
      console.error("refund failed", p.id, e);
    }
  }
}

// ------------------------------------------------------------------ sweep (lazy expiry, no cron needed)

export async function sweep(scope: { stationId?: string; venueId?: string } = {}) {
  const refunds = await tx(async (t) => {
    const where = scope.stationId
      ? t`station_id = ${scope.stationId}`
      : scope.venueId
        ? t`venue_id = ${scope.venueId}`
        : t`true`;
    const out: Payment[] = [];

    // Paid, nobody joined.
    const stale = await t<Match[]>`
      select * from chalk_matches where ${where} and status = 'open' and a_paid
         and opened_at < now() - make_interval(mins => ${RULES.OPEN_EXPIRES_MIN}) for update skip locked`;
    for (const m of stale) out.push(...(await voidInTx(t, m, "no opponent showed up")));

    // Tapped play, never paid.
    await t`
      update chalk_matches set status = 'voided', void_reason = 'never paid', ended_at = now()
       where ${where} and status = 'open' and not a_paid
         and opened_at < now() - make_interval(mins => ${RULES.UNPAID_EXPIRES_MIN})`;
    await t`
      update chalk_payments set status = 'failed'
       where status = 'pending' and kind = 'entry'
         and match_id in (select id from chalk_matches where ${where} and status = 'voided' and void_reason = 'never paid')`;

    // One player picked, other went quiet -> bartender.
    await t`
      update chalk_matches set status = 'disputed', disputed_at = coalesce(disputed_at, now())
       where ${where} and status = 'live' and first_pick_at is not null
         and first_pick_at < now() - make_interval(mins => ${RULES.PICK_WAIT_MIN})`;

    // Live, nobody ever picked.
    const abandoned = await t<Match[]>`
      select * from chalk_matches where ${where} and status = 'live' and first_pick_at is null
         and live_at < now() - make_interval(mins => ${RULES.LIVE_ABANDON_MIN}) for update skip locked`;
    for (const m of abandoned) out.push(...(await voidInTx(t, m, "abandoned")));

    // Disputed, no bartender ever settled it.
    const unresolved = await t<Match[]>`
      select * from chalk_matches where ${where} and status = 'disputed'
         and coalesce(disputed_at, first_pick_at) < now() - make_interval(mins => ${RULES.DISPUTE_VOID_MIN}) for update skip locked`;
    for (const m of unresolved) out.push(...(await voidInTx(t, m, "unresolved dispute")));

    // Card refunds that are owed but haven't gone through yet: retry.
    const retry = await t<Payment[]>`
      select * from chalk_payments where refund_due and status = 'paid' and method = 'card' and refunded_cents = 0
       order by created_at asc limit 20`;
    out.push(...retry);
    return out;
  });
  await runRefunds(refunds);
}

// ------------------------------------------------------------------ station view

export async function stationView(code: string, playerId: string | null) {
  const station = await stationByCode(code);
  if (!station) return null;
  await sweep({ stationId: station.id }).catch((e) => console.error("sweep", e));
  const q = await db();
  const match = await currentMatch(station.id);
  const venue = station.venue;

  let players: Record<string, { id: string; first_name: string }> = {};
  if (match) {
    const ids = [match.player_a_id, match.player_b_id].filter(Boolean) as string[];
    const rows = await q<{ id: string; first_name: string }[]>`select id, first_name from chalk_players where id = any(${ids})`;
    players = Object.fromEntries(rows.map((r) => [r.id, r]));
  }
  const staff = await onShiftStaff(venue.id);
  const me = playerId ? await playerById(playerId) : null;

  // Player's own pending (unpaid) match on this table, so a refresh returns them to the pay screen.
  let myPending: { paymentId: string; matchId: string } | null = null;
  if (me) {
    const [pp] = await q<{ id: string; match_id: string }[]>`
      select p.id, p.match_id from chalk_payments p join chalk_matches m on m.id = p.match_id
       where p.player_id = ${me.id} and p.status = 'pending' and p.kind = 'entry' and m.station_id = ${station.id}
         and m.status = 'open' order by p.created_at desc limit 1`;
    if (pp) myPending = { paymentId: pp.id, matchId: pp.match_id };
  }

  // Last finished game on this table, so the loser can see it and run it back.
  const [last] = await q<Match[]>`
    select * from chalk_matches where station_id = ${station.id} and status = 'completed'
       and ended_at > now() - interval '20 minutes' order by ended_at desc limit 1`;
  let lastPlayers: Record<string, string> = {};
  if (last) {
    const rows = await q<{ id: string; first_name: string }[]>`
      select id, first_name from chalk_players where id = any(${[last.player_a_id, last.player_b_id].filter(Boolean) as string[]})`;
    lastPlayers = Object.fromEntries(rows.map((r) => [r.id, r.first_name]));
  }

  return {
    venue: { id: venue.id, name: venue.name, slug: venue.slug, prize_mode: venue.prize_mode, stakes: venue.stake_options_cents, free: !!venue.free_until && new Date(venue.free_until) >= new Date() },
    station: { id: station.id, code: station.code, name: station.name, game: station.game },
    split: Object.fromEntries(venue.stake_options_cents.map((s) => [s, computeSplit(s, venue)])),
    match: match
      ? {
          id: match.id,
          status: match.status,
          stake_cents: match.stake_cents,
          pot_cents: match.pot_cents,
          winner_cents: match.winner_cents,
          prize_mode: match.prize_mode,
          a: match.player_a_id ? { id: match.player_a_id, name: players[match.player_a_id]?.first_name || "Player 1" } : null,
          b: match.player_b_id ? { id: match.player_b_id, name: players[match.player_b_id]?.first_name || "Player 2" } : null,
          a_pick: match.a_pick,
          b_pick: match.b_pick,
          winner_id: match.winner_id,
          opened_at: match.opened_at,
          live_at: match.live_at,
        }
      : null,
    last: last
      ? {
          id: last.id,
          winner: last.winner_id ? lastPlayers[last.winner_id] : null,
          loser: last.winner_id ? lastPlayers[last.winner_id === last.player_a_id ? last.player_b_id! : last.player_a_id!] : null,
          winner_id: last.winner_id,
          winner_cents: last.winner_cents,
          prize_mode: last.prize_mode,
          prize_redeemed: !!last.prize_redeemed_at,
          player_ids: [last.player_a_id, last.player_b_id],
        }
      : null,
    staff,
    me: me ? { id: me.id, first_name: me.first_name, balance_cents: me.balance_cents, verified: !!me.verified_at, locked: me.locked } : null,
    myPending,
    demo: env.demoPayments,
    otp: env.otpEnabled,
    now: new Date().toISOString(),
  };
}

export type StationView = NonNullable<Awaited<ReturnType<typeof stationView>>>;
