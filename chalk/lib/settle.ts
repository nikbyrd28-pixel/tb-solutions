import { db, tx } from "./db";
import { env } from "./env";
import { accountReady, stripeReady, transfer } from "./stripe";
import type { Staff, Venue } from "./types";

// What a venue is owed right now (games + events), before it's rolled into a settlement.
export async function venueOwed(venueId: string) {
  const q = await db();
  const [g] = await q<{ cents: number; games: number }[]>`
    select coalesce(sum(bar_cents),0)::int as cents, count(*)::int as games from chalk_matches
     where venue_id = ${venueId} and status = 'completed' and venue_settlement_id is null`;
  const [e] = await q<{ cents: number; entries: number }[]>`
    select coalesce(sum(ev.entry_cents - floor(ev.entry_cents * v.event_platform_fee_bps / 10000.0)),0)::int as cents, count(*)::int as entries
      from chalk_event_entries ee join chalk_events ev on ev.id = ee.event_id join chalk_venues v on v.id = ev.venue_id
     where ev.venue_id = ${venueId} and ee.status in ('paid','checked_in') and ee.payment_id is not null and ee.venue_settlement_id is null`;
  const [p] = await q<{ cents: number }[]>`
    select coalesce(sum(amount_cents),0)::int as cents from chalk_settlements where venue_id = ${venueId} and payee_type = 'venue' and status = 'pending'`;
  return { games_cents: g.cents, games: g.games, events_cents: e.cents, entries: e.entries, pending_cents: p.cents, total_cents: g.cents + e.cents + p.cents };
}

// Roll the venue's unsettled earnings into one settlement row, then try to pay every pending one.
export async function settleVenue(venue: Venue, periodEnd = new Date()) {
  const created = await tx(async (t) => {
    const [s] = await t<{ id: string }[]>`
      insert into chalk_settlements (payee_type, venue_id, amount_cents, status, period_end, note)
      values ('venue', ${venue.id}, 0, 'pending', ${periodEnd.toISOString().slice(0, 10)}, 'weekly') returning id`;
    const gm = await t<{ n: number; cents: number }[]>`
      with u as (update chalk_matches set venue_settlement_id = ${s.id}
                  where venue_id = ${venue.id} and status = 'completed' and venue_settlement_id is null returning bar_cents)
      select count(*)::int as n, coalesce(sum(bar_cents),0)::int as cents from u`;
    const ev = await t<{ n: number; cents: number }[]>`
      with u as (update chalk_event_entries ee set venue_settlement_id = ${s.id}
                  from chalk_events e where e.id = ee.event_id and e.venue_id = ${venue.id}
                   and ee.status in ('paid','checked_in') and ee.payment_id is not null and ee.venue_settlement_id is null
                 returning e.entry_cents - floor(e.entry_cents * ${venue.event_platform_fee_bps} / 10000.0) as cents)
      select count(*)::int as n, coalesce(sum(cents),0)::int as cents from u`;
    const total = gm[0].cents + ev[0].cents;
    if (total <= 0) {
      await t`delete from chalk_settlements where id = ${s.id}`;
      return null;
    }
    await t`update chalk_settlements set amount_cents = ${total}, note = ${`${gm[0].n} games, ${ev[0].n} event entries`} where id = ${s.id}`;
    return s.id;
  });
  const paid = await payPending("venue", venue.id, venue.stripe_account_id, venue.stripe_onboarded, `${venue.name} weekly`);
  return { created, ...paid };
}

export async function settleStaff(staff: Staff) {
  await tx(async (t) => {
    const [s] = await t<{ id: string }[]>`
      insert into chalk_settlements (payee_type, staff_id, venue_id, amount_cents, status, note)
      values ('staff', ${staff.id}, ${staff.venue_id}, 0, 'pending', 'tips') returning id`;
    const r = await t<{ n: number; cents: number }[]>`
      with u as (update chalk_tips set settlement_id = ${s.id}, status = 'paid'
                  where staff_id = ${staff.id} and status = 'pending' and settlement_id is null returning staff_cents)
      select count(*)::int as n, coalesce(sum(staff_cents),0)::int as cents from u`;
    if (r[0].cents <= 0) {
      await t`delete from chalk_settlements where id = ${s.id}`;
      return;
    }
    await t`update chalk_settlements set amount_cents = ${r[0].cents}, note = ${`${r[0].n} tips`} where id = ${s.id}`;
  });
  return payPending("staff", staff.id, staff.stripe_account_id, staff.stripe_onboarded, `${staff.name} tips`);
}

async function payPending(kind: "venue" | "staff", id: string, accountId: string | null, onboarded: boolean, label: string) {
  const q = await db();
  const col = kind === "venue" ? "venue_id" : "staff_id";
  const pending = await q<{ id: string; amount_cents: number }[]>`
    select id, amount_cents from chalk_settlements where payee_type = ${kind} and ${q(col)} = ${id} and status = 'pending' order by created_at`;
  if (!pending.length) return { paid: 0, pending: 0 };
  if (!stripeReady() || env.demoPayments || !accountId) return { paid: 0, pending: pending.reduce((a, b) => a + b.amount_cents, 0) };
  if (!onboarded) {
    const ready = await accountReady(accountId).catch(() => false);
    if (!ready) return { paid: 0, pending: pending.reduce((a, b) => a + b.amount_cents, 0) };
    const table = kind === "venue" ? "chalk_venues" : "chalk_staff";
    await q`update ${q(table)} set stripe_onboarded = true where id = ${id}`;
  }
  let paid = 0;
  let left = 0;
  for (const s of pending) {
    try {
      const tr = await transfer(accountId, s.amount_cents, `Chalk ${label}`, `settle-${s.id}`);
      await q`update chalk_settlements set status = 'paid', stripe_transfer_id = ${tr.id}, paid_at = now() where id = ${s.id}`;
      paid += s.amount_cents;
    } catch (e) {
      console.error("transfer failed", s.id, (e as Error).message);
      left += s.amount_cents;
    }
  }
  return { paid, pending: left };
}

export async function settleEverything() {
  const q = await db();
  const venues = await q<Venue[]>`select * from chalk_venues where status <> 'closed'`;
  const staff = await q<Staff[]>`select * from chalk_staff where active`;
  const out: Record<string, unknown> = {};
  for (const v of venues) out[`venue:${v.slug}`] = await settleVenue(v);
  for (const s of staff) out[`staff:${s.id}`] = await settleStaff(s);
  return out;
}
