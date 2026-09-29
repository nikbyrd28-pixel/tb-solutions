import { handler, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, body, json } from "@/lib/util";

export const dynamic = "force-dynamic";

// Lock/unlock a player, or hand-adjust a balance (with a note, so the ledger says why).
export const POST = handler(async (req) => {
  await requireAdmin();
  const b = await body<{ player_id?: string; locked?: boolean; adjust_cents?: number; note?: string }>(req);
  if (!b.player_id) return bad("player_id");
  const q = await db();
  if (typeof b.locked === "boolean") await q`update chalk_players set locked = ${b.locked} where id = ${b.player_id}`;
  if (b.adjust_cents) {
    const delta = Math.round(Number(b.adjust_cents));
    if (!delta) return bad("adjust_cents");
    await q`select chalk_adjust_balance(${b.player_id}, ${delta}, 'adjust', null, null, ${(b.note || "admin adjustment").slice(0, 120)})`;
  }
  return json({ ok: true });
});
