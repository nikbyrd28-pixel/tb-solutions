import { handler, requirePlayer } from "@/lib/auth";
import { markPaid, paymentById } from "@/lib/matches";
import { retrieveIntent, stripeReady } from "@/lib/stripe";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// The browser calls this after Stripe says the payment went through (and on every reload of the
// pay screen). The webhook usually gets there first; both paths are idempotent.
export const POST = handler(async (req) => {
  const { player } = await requirePlayer();
  const { payment_id } = await body<{ payment_id?: string }>(req);
  if (!payment_id) return bad("payment_id");
  let p = await paymentById(payment_id);
  if (!p || p.player_id !== player.id) return bad("Not your payment", 404);
  if (p.status === "pending" && p.method === "card" && p.stripe_payment_intent_id && stripeReady()) {
    const pi = await retrieveIntent(p.stripe_payment_intent_id);
    if (pi.status === "succeeded") p = await markPaid(p.id, pi.id);
    else if (pi.status === "canceled") {
      const { db } = await import("@/lib/db");
      const q = await db();
      await q`update chalk_payments set status = 'failed' where id = ${p.id} and status = 'pending'`;
      p = { ...p, status: "failed" };
    }
  }
  return json({ status: p.status, match_id: p.match_id, event_entry_id: p.event_entry_id });
});
