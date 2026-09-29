import { handler, requirePlayer } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountReady, createExpressAccount, onboardingLink, stripeReady } from "@/lib/stripe";
import { bad, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Sets up (or resumes) the player's Stripe Express account so we can send them their winnings.
export const POST = handler(async () => {
  const { player, verified } = await requirePlayer();
  if (!verified) return bad("Verify your number first");
  if (!stripeReady()) return bad("Cash-out isn't turned on yet", 503);
  const q = await db();
  let accountId = player.stripe_account_id;
  if (!accountId) {
    const acct = await createExpressAccount({ phone: player.phone, label: `${player.first_name} (Chalk player)`, individual: true });
    accountId = acct.id;
    await q`update chalk_players set stripe_account_id = ${accountId} where id = ${player.id}`;
  } else if (await accountReady(accountId)) {
    await q`update chalk_players set stripe_onboarded = true where id = ${player.id}`;
    return json({ ready: true });
  }
  const url = await onboardingLink(accountId, "/me");
  return json({ ready: false, url });
});
