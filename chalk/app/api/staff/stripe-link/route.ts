import { handler, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountReady, createExpressAccount, onboardingLink, stripeReady } from "@/lib/stripe";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Bartender's own payout account for tips.
export const POST = handler(async () => {
  const { staff, venue } = await requireStaff();
  if (!stripeReady()) return bad("Payouts aren't turned on yet", 503);
  const q = await db();
  let accountId = staff.stripe_account_id;
  if (!accountId) {
    const acct = await createExpressAccount({ phone: staff.phone, label: `${staff.name} at ${venue.name}`, individual: true });
    accountId = acct.id;
    await q`update chalk_staff set stripe_account_id = ${accountId} where id = ${staff.id}`;
  } else if (await accountReady(accountId)) {
    await q`update chalk_staff set stripe_onboarded = true where id = ${staff.id}`;
    return json({ ready: true });
  }
  const url = await onboardingLink(accountId, "/staff");
  return json({ ready: false, url });
});
