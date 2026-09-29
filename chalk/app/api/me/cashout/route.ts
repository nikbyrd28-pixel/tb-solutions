import { handler, requirePlayer } from "@/lib/auth";
import { db, tx } from "@/lib/db";
import { RULES } from "@/lib/env";
import { accountReady, stripeReady, transfer } from "@/lib/stripe";
import { bad, json, money } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const { player, verified } = await requirePlayer();
  if (!verified) return bad("Verify your number first");
  if (!stripeReady()) return bad("Cash-out isn't turned on yet", 503);
  if (player.locked) return bad("Account locked. Ask the bartender.");
  if (player.balance_cents < RULES.MIN_CASHOUT_CENTS) return bad(`Minimum cash-out is ${money(RULES.MIN_CASHOUT_CENTS)}`);
  const q = await db();
  if (!player.stripe_account_id) return bad("Set up your payout account first");
  if (!player.stripe_onboarded) {
    if (!(await accountReady(player.stripe_account_id))) return bad("Finish setting up your payout account first");
    await q`update chalk_players set stripe_onboarded = true where id = ${player.id}`;
  }

  // Take it out of the balance first, then move the money. If Stripe fails, put it back.
  const { amount, settlementId } = await tx(async (t) => {
    const [p] = await t<{ balance_cents: number }[]>`select balance_cents from chalk_players where id = ${player.id} for update`;
    const amount = p.balance_cents;
    if (amount < RULES.MIN_CASHOUT_CENTS) throw new Error("Nothing to cash out");
    await t`select chalk_adjust_balance(${player.id}, ${-amount}, 'cashout', null, null, 'Cash out to bank')`;
    const [s] = await t<{ id: string }[]>`
      insert into chalk_settlements (payee_type, player_id, amount_cents, status, note)
      values ('player', ${player.id}, ${amount}, 'pending', 'player cash-out') returning id`;
    return { amount, settlementId: s.id };
  });
  try {
    const tr = await transfer(player.stripe_account_id, amount, `Chalk winnings ${player.first_name}`, `cashout-${settlementId}`);
    await q`update chalk_settlements set status = 'paid', stripe_transfer_id = ${tr.id}, paid_at = now() where id = ${settlementId}`;
  } catch (e) {
    await q`select chalk_adjust_balance(${player.id}, ${amount}, 'adjust', null, null, 'Cash-out failed, money returned')`;
    await q`update chalk_settlements set status = 'failed', note = ${String((e as Error).message).slice(0, 200)} where id = ${settlementId}`;
    return bad("Payout failed. Your balance is back. Try again in a bit.");
  }
  return json({ ok: true, amount_cents: amount });
});
