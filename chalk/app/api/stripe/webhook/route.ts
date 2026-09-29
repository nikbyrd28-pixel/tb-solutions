import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { markPaid } from "@/lib/matches";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Stripe -> us. Verified with the signing secret, deduped by event id, idempotent underneath.
export async function POST(req: Request) {
  if (!env.stripeSecret || !env.stripeWebhookSecret) return new Response("webhook not configured", { status: 503 });
  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (e) {
    return new Response(`bad signature: ${(e as Error).message}`, { status: 400 });
  }
  const q = await db();
  const inserted = await q`insert into chalk_webhook_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
  if (!inserted.length) return Response.json({ received: true, duplicate: true });

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = pi.metadata?.paymentId;
      if (paymentId) await markPaid(paymentId, pi.id);
    } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentId = pi.metadata?.paymentId;
      if (paymentId) await q`update chalk_payments set status = 'failed' where id = ${paymentId} and status = 'pending'`;
    } else if (event.type === "charge.refunded") {
      const ch = event.data.object as Stripe.Charge;
      const piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (piId) await q`update chalk_payments set status = 'refunded', refunded_cents = greatest(refunded_cents, ${ch.amount_refunded}), refund_due = false where stripe_payment_intent_id = ${piId}`;
    } else if (event.type === "account.updated") {
      const acct = event.data.object as Stripe.Account;
      if (acct.payouts_enabled) {
        await q`update chalk_venues set stripe_onboarded = true where stripe_account_id = ${acct.id}`;
        await q`update chalk_staff set stripe_onboarded = true where stripe_account_id = ${acct.id}`;
        await q`update chalk_players set stripe_onboarded = true where stripe_account_id = ${acct.id}`;
      }
    }
    await q`update chalk_webhook_events set processed_at = now() where id = ${event.id}`;
  } catch (e) {
    console.error("webhook handler failed", event.type, (e as Error).message);
    await q`delete from chalk_webhook_events where id = ${event.id}`; // let Stripe retry it
    return new Response("handler failed", { status: 500 });
  }
  return Response.json({ received: true });
}
