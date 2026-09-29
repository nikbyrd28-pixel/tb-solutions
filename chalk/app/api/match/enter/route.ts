import { handler, requirePlayer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createEntry, stationByCode } from "@/lib/matches";
import { createIntent } from "@/lib/stripe";
import { bad, body, json, money } from "@/lib/util";

export const dynamic = "force-dynamic";

type Body = {
  code?: string;
  stake_cents?: number;
  join_match_id?: string;
  tip_cents?: number;
  tip_staff_id?: string | null;
  method?: "card" | "balance" | "demo";
};

export const POST = handler(async (req) => {
  const { player, verified } = await requirePlayer();
  const b = await body<Body>(req);
  const station = await stationByCode(b.code || "");
  if (!station || !station.active) return bad("No table with that code", 404);
  const venue = station.venue;
  if (venue.status !== "active") return bad("This bar isn't running games right now");

  const tip = Math.max(0, Math.round(Number(b.tip_cents) || 0));
  let tipStaffId: string | null = null;
  if (tip > 0) {
    const q = await db();
    const [st] = await q<{ id: string }[]>`select id from chalk_staff where id = ${b.tip_staff_id || null} and venue_id = ${venue.id} and active`;
    if (!st) return bad("Pick who you're tipping");
    tipStaffId = st.id;
  }

  let method = b.method || "card";
  if (method === "demo" && !env.demoPayments) method = "card";
  if (method === "card" && env.demoPayments) method = "demo";

  const stake = b.join_match_id ? 0 : Math.round(Number(b.stake_cents) || 0);
  if (method === "balance") {
    if (!verified) return bad("Verify your number to pay from your balance");
  }

  const { payment, match } = await createEntry({
    station,
    venue,
    player,
    stakeCents: stake,
    tipCents: tip,
    tipStaffId,
    method,
    joinMatchId: b.join_match_id,
  });

  if (payment.status === "paid") {
    return json({ payment_id: payment.id, paid: true, match_id: payment.match_id });
  }

  // Card: hand the browser a PaymentIntent.
  const pi = await createIntent({
    amountCents: payment.amount_cents,
    paymentId: payment.id,
    description: `${venue.name} ${station.name}: ${money(match.stake_cents)} game${tip ? ` + ${money(tip)} tip` : ""}`,
    metadata: { match_id: match.id, venue: venue.slug },
  });
  const q = await db();
  await q`update chalk_payments set stripe_payment_intent_id = ${pi.id} where id = ${payment.id}`;
  return json({
    payment_id: payment.id,
    paid: false,
    match_id: match.id,
    client_secret: pi.client_secret,
    publishable_key: env.stripePublishable,
    amount_cents: payment.amount_cents,
  });
});
