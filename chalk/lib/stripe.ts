import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!env.stripeSecret) throw new Error("Stripe is not configured");
  if (!client) client = new Stripe(env.stripeSecret);
  return client;
}

export const stripeReady = () => !!env.stripeSecret;

export async function createIntent(opts: {
  amountCents: number;
  paymentId: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const pi = await stripe().paymentIntents.create({
    amount: opts.amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: opts.description,
    metadata: { paymentId: opts.paymentId, ...(opts.metadata || {}) },
  });
  return pi;
}

export async function retrieveIntent(id: string) {
  return stripe().paymentIntents.retrieve(id);
}

export async function refundIntent(id: string, amountCents: number) {
  return stripe().refunds.create({ payment_intent: id, amount: amountCents });
}

// Connect Express: bars, bartenders, and players who cash out all get one of these.
export async function createExpressAccount(opts: { email?: string; phone?: string; label: string; individual: boolean }) {
  return stripe().accounts.create({
    type: "express",
    country: "US",
    business_type: opts.individual ? "individual" : undefined,
    capabilities: { transfers: { requested: true } },
    business_profile: { name: opts.label, product_description: "Bar games, tips and events via Chalk" },
    metadata: { label: opts.label },
  });
}

export async function onboardingLink(accountId: string, returnPath: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}${returnPath}?stripe=refresh`,
    return_url: `${env.appUrl}${returnPath}?stripe=done`,
  });
  return link.url;
}

export async function accountReady(accountId: string) {
  const a = await stripe().accounts.retrieve(accountId);
  return !!a.payouts_enabled;
}

export async function transfer(accountId: string, amountCents: number, description: string, idempotencyKey: string) {
  return stripe().transfers.create(
    { amount: amountCents, currency: "usd", destination: accountId, description },
    { idempotencyKey },
  );
}
