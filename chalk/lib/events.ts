import { db, tx, type Q } from "./db";
import type { BracketMatch, EventEntry, EventRow, Venue } from "./types";

export async function eventById(id: string, q?: Q) {
  const c = q || (await db());
  const [e] = await c<(EventRow & { venue: Venue })[]>`
    select e.*, row_to_json(v.*) as venue from chalk_events e join chalk_venues v on v.id = e.venue_id where e.id = ${id}`;
  return e || null;
}

export async function eventEntries(eventId: string, q?: Q) {
  const c = q || (await db());
  return c<EventEntry[]>`
    select * from chalk_event_entries where event_id = ${eventId} and status in ('paid','checked_in')
     order by coalesce(seed, 9999), created_at asc`;
}

export async function bracket(eventId: string, q?: Q) {
  const c = q || (await db());
  return c<BracketMatch[]>`select * from chalk_bracket_matches where event_id = ${eventId} order by round, position`;
}

function shuffle<T>(a: T[]) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Standard bracket order for a power-of-two size: seed 1 vs size, 2 vs size-1, spread so 1 and 2 meet last.
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const s = order.length * 2 + 1;
    for (const x of order) next.push(x, s - x);
    order = next;
  }
  return order;
}

export async function startBracket(eventId: string) {
  return tx(async (t) => {
    const [e] = await t<EventRow[]>`select * from chalk_events where id = ${eventId} for update`;
    if (!e) throw new Error("event not found");
    if (e.status === "live" || e.bracket_started_at) throw new Error("Bracket already started");
    const entries = shuffle(await eventEntries(eventId, t));
    if (entries.length < 2) throw new Error("Need at least 2 paid players");
    for (let i = 0; i < entries.length; i++) {
      await t`update chalk_event_entries set seed = ${i + 1}, status = 'checked_in' where id = ${entries[i].id}`;
    }
    await t`delete from chalk_bracket_matches where event_id = ${eventId}`;

    if (e.format === "round_robin") {
      let pos = 0;
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          await t`insert into chalk_bracket_matches (event_id, round, position, entry_a_id, entry_b_id, status)
                  values (${eventId}, 1, ${pos++}, ${entries[i].id}, ${entries[j].id}, 'ready')`;
        }
      }
    } else {
      const n = entries.length;
      let size = 2;
      while (size < n) size *= 2;
      const rounds = Math.log2(size);
      // create every match first so we can link next_match_id
      const ids: Record<string, string> = {};
      for (let r = 1; r <= rounds; r++) {
        const count = size / Math.pow(2, r);
        for (let p = 0; p < count; p++) {
          const [row] = await t<{ id: string }[]>`insert into chalk_bracket_matches (event_id, round, position) values (${eventId}, ${r}, ${p}) returning id`;
          ids[`${r}:${p}`] = row.id;
        }
      }
      for (let r = 1; r < rounds; r++) {
        const count = size / Math.pow(2, r);
        for (let p = 0; p < count; p++) {
          await t`update chalk_bracket_matches set next_match_id = ${ids[`${r + 1}:${Math.floor(p / 2)}`]}, next_slot = ${p % 2 === 0 ? "a" : "b"} where id = ${ids[`${r}:${p}`]}`;
        }
      }
      // seed round 1
      const order = seedOrder(size);
      for (let p = 0; p < size / 2; p++) {
        const sa = order[p * 2];
        const sb = order[p * 2 + 1];
        const a = sa <= n ? entries[sa - 1].id : null;
        const b = sb <= n ? entries[sb - 1].id : null;
        const id = ids[`1:${p}`];
        if (a && b) {
          await t`update chalk_bracket_matches set entry_a_id = ${a}, entry_b_id = ${b}, status = 'ready' where id = ${id}`;
        } else {
          const w = a || b;
          await t`update chalk_bracket_matches set entry_a_id = ${a}, entry_b_id = ${b}, winner_entry_id = ${w}, status = 'bye' where id = ${id}`;
          if (w) await advance(t, id, w);
        }
      }
    }
    await t`update chalk_events set status = 'live', bracket_started_at = now() where id = ${eventId}`;
  });
}

async function advance(t: Q, matchId: string, winnerEntryId: string) {
  const [m] = await t<BracketMatch[]>`select * from chalk_bracket_matches where id = ${matchId}`;
  if (!m?.next_match_id) return;
  const col = m.next_slot === "a" ? "entry_a_id" : "entry_b_id";
  await t`update chalk_bracket_matches set ${t(col)} = ${winnerEntryId} where id = ${m.next_match_id}`;
  const [nm] = await t<BracketMatch[]>`select * from chalk_bracket_matches where id = ${m.next_match_id}`;
  if (nm.entry_a_id && nm.entry_b_id && nm.status === "pending") {
    await t`update chalk_bracket_matches set status = 'ready' where id = ${nm.id}`;
  }
}

export async function recordResult(eventId: string, bracketMatchId: string, winnerEntryId: string) {
  return tx(async (t) => {
    const [m] = await t<BracketMatch[]>`select * from chalk_bracket_matches where id = ${bracketMatchId} and event_id = ${eventId} for update`;
    if (!m) throw new Error("match not found");
    if (m.status !== "ready" && m.status !== "done") throw new Error("Not ready yet");
    if (winnerEntryId !== m.entry_a_id && winnerEntryId !== m.entry_b_id) throw new Error("Bad winner");
    if (m.status === "done") {
      if (m.winner_entry_id === winnerEntryId) return;
      // correcting a result: only allowed if the next match hasn't been played
      if (m.next_match_id) {
        const [nm] = await t<BracketMatch[]>`select * from chalk_bracket_matches where id = ${m.next_match_id}`;
        if (nm.status === "done") throw new Error("Next round already played");
      }
      const prevW = m.winner_entry_id!;
      const prevL = prevW === m.entry_a_id ? m.entry_b_id! : m.entry_a_id!;
      await t`update chalk_event_entries set wins = wins - 1 where id = ${prevW}`;
      await t`update chalk_event_entries set losses = losses - 1 where id = ${prevL}`;
    }
    const loser = winnerEntryId === m.entry_a_id ? m.entry_b_id! : m.entry_a_id!;
    await t`update chalk_bracket_matches set winner_entry_id = ${winnerEntryId}, status = 'done' where id = ${m.id}`;
    await t`update chalk_event_entries set wins = wins + 1 where id = ${winnerEntryId}`;
    await t`update chalk_event_entries set losses = losses + 1 where id = ${loser}`;
    await advance(t, m.id, winnerEntryId);
    const [left] = await t<{ n: number }[]>`select count(*)::int as n from chalk_bracket_matches where event_id = ${eventId} and status in ('pending','ready')`;
    if (left.n === 0) await t`update chalk_events set status = 'done' where id = ${eventId}`;
  });
}

export async function eventView(eventId: string) {
  const e = await eventById(eventId);
  if (!e) return null;
  const q = await db();
  const entries = await q<(EventEntry & { first_name: string | null })[]>`
    select ee.*, p.first_name from chalk_event_entries ee left join chalk_players p on p.id = ee.player_id
     where ee.event_id = ${eventId} and ee.status in ('paid','checked_in') order by coalesce(ee.seed, 9999), ee.created_at`;
  const matches = await bracket(eventId);
  const names = Object.fromEntries(entries.map((x) => [x.id, x.display_name]));
  const rounds = Math.max(0, ...matches.map((m) => m.round));
  const champion = e.status === "done" && e.format === "single_elim"
    ? matches.find((m) => m.round === rounds)?.winner_entry_id
    : null;
  return {
    event: {
      id: e.id, name: e.name, game: e.game, format: e.format, entry_cents: e.entry_cents, service_fee_cents: e.service_fee_cents,
      capacity: e.capacity, starts_at: e.starts_at, prize_text: e.prize_text, status: e.status,
    },
    venue: { id: e.venue.id, name: e.venue.name, slug: e.venue.slug },
    entries: entries.map((x) => ({ id: x.id, name: x.display_name, seed: x.seed, wins: x.wins, losses: x.losses, status: x.status })),
    spots_left: Math.max(0, e.capacity - entries.length),
    matches: matches.map((m) => ({
      id: m.id, round: m.round, position: m.position, status: m.status,
      a: m.entry_a_id ? { id: m.entry_a_id, name: names[m.entry_a_id] || "?" } : null,
      b: m.entry_b_id ? { id: m.entry_b_id, name: names[m.entry_b_id] || "?" } : null,
      winner_entry_id: m.winner_entry_id,
    })),
    rounds,
    champion: champion ? names[champion] : null,
  };
}
