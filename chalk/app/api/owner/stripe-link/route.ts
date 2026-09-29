import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountReady, createExpressAccount, onboardingLink, stripeReady } from "@/lib/stripe";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// The bar's payout account. Owner types their own bank details on Stripe's page; we never see them.
export const POST = handler(async () => {
  const { venue } = await requireStaff(["owner"]);
  if (!stripeReady()) return bad("Payouts aren't turned on yet", 503);
  const q = await db();
  let accountId = venue.stripe_account_id;
  if (!accountId) {
    const acct = await createExpressAccount({ label: venue.name, individual: false });
    accountId = acct.id;
    await q`update chalk_venues set stripe_account_id = ${accountId} where id = ${venue.id}`;
  } else if (await accountReady(accountId)) {
    await q`update chalk_venues set stripe_onboarded = true where id = ${venue.id}`;
    return json({ ready: true });
  }
  const url = await onboardingLink(accountId, "/owner");
  return json({ ready: false, url });
});
