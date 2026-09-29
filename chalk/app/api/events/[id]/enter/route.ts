import { handler, requirePlayer } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { env } from "@/lib/env";
import { eventById } from "@/lib/events";
import { markPaid } from "@/lib/matches";
import { createIntent } from "@/lib/stripe";
import type { Payment } from "@/lib/types";
import { bad, body, json, money } from "@/lib/util";

export const dynamic = "force-dynamic";

// Register + pay for an event. Free events skip payment entirely.
export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const { player } = await requirePlayer();
  const { display_name } = await body<{ display_name?: string }>(req);
  const e = await eventById(id);
  if (!e) return bad("No such event", 404);
  if (e.status !== "open") return bad("Signups are closed");
  const name = (display_name || player.first_name).trim().slice(0, 24) || player.first_name;

  const { entry, payment } = await tx(async (t) => {
    const [count] = await t<{ n: number }[]>`select count(*)::int as n from chalk_event_entries where event_id = ${id} and status in ('paid','checked_in')`;
    if (count.n >= e.capacity) throw new Error("It's full");
    const [existing] = await t<{ id: string; status: string; payment_id: string | null }[]>`
      select id, status, payment_id from chalk_event_entries where event_id = ${id} and player_id = ${player.id} and status in ('paid','checked_in','pending') order by created_at desc limit 1`;
    if (existing && existing.status !== "pending") throw new Error("You're already in");
    let entryId = existing?.id;
    if (!entryId) {
      const [ne] = await t<{ id: string }[]>`
        insert into chalk_event_entries (event_id, player_id, display_name, phone, status)
        values (${id}, ${player.id}, ${name}, ${player.phone}, ${e.entry_cents > 0 ? "pending" : "paid"}) returning id`;
      entryId = ne.id;
    }
    if (e.entry_cents <= 0) return { entry: entryId, payment: null as Payment | null };
    const total = e.entry_cents + e.service_fee_cents;
    const method = env.demoPayments ? "demo" : "card";
    const [p] = await t<Payment[]>`
      insert into chalk_payments (player_id, venue_id, kind, event_entry_id, amount_cents, entry_cents, fee_cents, method)
      values (${player.id}, ${e.venue_id}, 'ticket', ${entryId}, ${total}, ${e.entry_cents}, ${e.service_fee_cents}, ${method}) returning *`;
    await t`update chalk_event_entries set payment_id = ${p.id} where id = ${entryId}`;
    return { entry: entryId, payment: p };
  });

  if (!payment) return json({ entry_id: entry, paid: true });
  if (payment.method === "demo") {
    await markPaid(payment.id);
    return json({ entry_id: entry, payment_id: payment.id, paid: true });
  }
  const pi = await createIntent({
    amountCents: payment.amount_cents,
    paymentId: payment.id,
    description: `${e.venue.name}: ${e.name} entry ${money(e.entry_cents)} + ${money(e.service_fee_cents)} fee`,
    metadata: { event_id: e.id, venue: e.venue.slug },
  });
  const q = await db();
  await q`update chalk_payments set stripe_payment_intent_id = ${pi.id} where id = ${payment.id}`;
  return json({ entry_id: entry, payment_id: payment.id, paid: false, client_secret: pi.client_secret, publishable_key: env.stripePublishable, amount_cents: payment.amount_cents });
});
